// Regression test for the SIGABRT-on-quit crash: node-pty exit watchers firing
// during node::FreeEnvironment (Napi::ThreadSafeFunction::CallJS throws while
// the env is being torn down). Boots the app with several live ptys, quits via
// the normal window-close path, and asserts a clean exit — several rounds,
// since the teardown race is timing-dependent.
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 9405;
const reap = () => { try { execSync(`pkill -9 -f \"remote-debugging-port=${PORT}"`); } catch (e) {} };
const ROUNDS = 5;
const delay = ms => new Promise(r => setTimeout(r, ms));
let pass = true;
const check = (name, cond, extra) => { console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  (" + extra + ")" : "")); if (!cond) pass = false; };

async function round(n) {
    const userData = path.join(appDir, ".smoke", "quit-ud");
    fs.rmSync(userData, { recursive: true, force: true }); fs.mkdirSync(userData, { recursive: true });
    const app = spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", `--remote-debugging-port=${PORT}`], {
        cwd: appDir, env: { ...process.env, DYOTERM_USER_DATA: userData, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" }, stdio: ["ignore", "ignore", "ignore"]
    });
    const exited = new Promise(res => app.on("exit", (code, signal) => res({ code, signal })));

    let ws, id = 0; const pend = new Map();
    const cdp = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); setTimeout(() => pend.has(i) && (pend.delete(i), rej(new Error("timeout " + m))), 20000); });
    const ev = (e) => cdp("Runtime.evaluate", { expression: `(async()=>{${e}})()`, returnByValue: true, awaitPromise: true }).then(r => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; });

    try {
        let target = null;
        for (let i = 0; i < 50 && !target; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = l.find(t => t.type === "page" && (t.url || "").includes("index.html")); } catch (e) {} await delay(800); }
        if (!target) throw new Error("no page target");
        ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
        await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
        ws.on("message", raw => { const m = JSON.parse(raw); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
        await cdp("Runtime.enable");
        for (let i = 0; i < 60; i++) { if (await ev("return !!(window.term && window.term.activeTab && window.term.activeTab() && window.term.activeTab().focused && window.term.activeTab().focused.id)")) break; await delay(500); }
        // more live ptys -> more exit watcher threads in flight at quit
        await ev("window.term.newTab(); return true"); await delay(700);
        await ev("window.term.splitFocused('vertical'); return true"); await delay(700);
        try { await ev(`window.dyo.win("close")`); } catch (e) { /* app may quit before replying */ }
        try { ws.close(); } catch (e) {}
    } catch (e) {
        console.error(`round ${n}: harness error:`, e.message);
        try { app.kill("SIGKILL"); } catch (err) {} reap();
        check(`round ${n} clean exit`, false, "harness error");
        return;
    }
    const result = await Promise.race([exited, delay(15000).then(() => null)]);
    if (!result) {
        try { app.kill("SIGKILL"); } catch (e) {} reap();
        await exited;
        check(`round ${n} clean exit`, false, "hang on quit (15s)");
        return;
    }
    check(`round ${n} clean exit`, result.code === 0 && !result.signal, `code=${result.code} signal=${result.signal}`);
}

for (let n = 1; n <= ROUNDS; n++) await round(n);
console.log(pass ? "\nALL PASS" : "\nFAILED");
process.exit(pass ? 0 : 1);
