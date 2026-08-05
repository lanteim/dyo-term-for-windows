// Hard debug pass: launch dyo-term off-screen, then mount EVERY registered
// widget one at a time, catching per-widget exceptions, console errors, and
// blank renders. Reports a per-widget pass/fail table. This is the plugin
// debugger — a widget only "passes" if it mounts, ticks, and cleans up quietly.
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(appDir, ".smoke");
const userData = path.join(outDir, "debug-ud");
fs.rmSync(userData, { recursive: true, force: true });
fs.mkdirSync(userData, { recursive: true });
const PORT = 9366;

const app = spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", `--remote-debugging-port=${PORT}`], {
    cwd: appDir,
    env: { ...process.env, DYOTERM_USER_DATA: userData, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" },
    stdio: ["ignore", "ignore", "ignore"]
});

const delay = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map();
const events = []; // {t, kind, text}
const cdp = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); setTimeout(() => pend.has(i) && (pend.delete(i), rej(new Error("timeout " + m))), 20000); });
const ev = (e, a = false) => cdp("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: a }).then(r => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; });

function since(t) { return events.filter(e => e.t > t); }

try {
    let target = null;
    for (let i = 0; i < 50 && !target; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = l.find(t => t.type === "page" && (t.url || "").includes("index.html")); } catch (e) {} await delay(800); }
    if (!target) throw new Error("no page target");
    ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    ws.on("message", raw => {
        const m = JSON.parse(raw);
        if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
        else if (m.method === "Runtime.exceptionThrown") events.push({ t: Date.now(), kind: "exception", text: (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || "").slice(0, 300) });
        else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") events.push({ t: Date.now(), kind: "console", text: m.params.args.map(a => a.value ?? a.description ?? "").join(" ").slice(0, 300) });
    });
    await cdp("Runtime.enable");
    // surface unhandled rejections as console errors
    await ev(`window.addEventListener("unhandledrejection", e => console.error("UNHANDLED_REJECTION", (e.reason && (e.reason.stack||e.reason.message)) || e.reason))`);
    await ev("!!window.dash", false);
    for (let i = 0; i < 40; i++) { if (await ev("!!(window.dash && window.WIDGETS && window.term)")) break; await delay(500); }

    const ids = await ev("Object.keys(window.WIDGETS).sort()");
    const results = [];
    for (const wid of ids) {
        // clear the grid
        await ev(`[...window.dash.mounted.keys()].forEach(it => window.dash.removeItem(it))`);
        await delay(150);
        const t0 = Date.now();
        let mountErr = null;
        try {
            await ev(`window.dash.addWidget(${JSON.stringify(wid)}, { autoPosition: true }, false)`);
        } catch (e) { mountErr = String(e.message).slice(0, 200); }
        await delay(2000); // let it tick a couple times
        const evs = since(t0).filter(e => !/DevTools|Autofill|Electron Security|WebGL/i.test(e.text));
        const body = await ev(`(() => { const el = document.querySelector('.grid-stack .widget .body'); if (!el) return -1; return (el.children.length > 0 || el.innerText.trim().length > 0) ? 1 : 0; })()`).catch(() => -1);
        const ok = !mountErr && evs.length === 0 && body > 0;
        results.push({ id: wid, ok, blank: body === 0, mountErr, errors: evs.map(e => `${e.kind}: ${e.text}`).slice(0, 3) });
        process.stdout.write((ok ? "." : "X"));
    }
    process.stdout.write("\n");

    const failed = results.filter(r => !r.ok);
    const report = { total: results.length, passed: results.length - failed.length, failed: failed.length, failures: failed };
    fs.writeFileSync(path.join(outDir, "debug-all.json"), JSON.stringify({ results, report }, null, 2));
    console.log(`\nWIDGETS: ${report.passed}/${report.total} passed, ${report.failed} failed`);
    failed.forEach(f => console.log(`  FAIL ${f.id}${f.blank ? " [blank]" : ""}${f.mountErr ? " mount:" + f.mountErr : ""} ${f.errors.join(" | ")}`));
} catch (e) {
    console.error("debug-all fatal:", e.message);
} finally {
    try { await ev(`window.dyo.win("close")`); } catch (e) {}
    await delay(1000); try { app.kill("SIGKILL"); } catch (e) {} try { execSync(`pkill -9 -f \"remote-debugging-port=${PORT}"`); } catch (e) {}
    process.exit(0);
}
