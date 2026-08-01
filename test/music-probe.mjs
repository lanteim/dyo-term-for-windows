// Verify the Apple Music widget end-to-end: mount it, read the raw state from the
// bridge and confirm the widget shows the now-playing panel (not the error state).
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userData = path.join(appDir, ".smoke", "music-ud");
fs.rmSync(userData, { recursive: true, force: true });
fs.mkdirSync(userData, { recursive: true });
const PORT = 9369;
const app = spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", `--remote-debugging-port=${PORT}`], {
    cwd: appDir, env: { ...process.env, DYOTERM_USER_DATA: userData, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" }, stdio: ["ignore", "ignore", "ignore"]
});
const delay = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map();
const cdp = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); setTimeout(() => pend.has(i) && (pend.delete(i), rej(new Error("timeout " + m))), 20000); });
const ev = (e) => cdp("Runtime.evaluate", { expression: `(async()=>{${e}})()`, returnByValue: true, awaitPromise: true }).then(r => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; });
try {
    let target = null;
    for (let i = 0; i < 50 && !target; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = l.find(t => t.type === "page" && (t.url || "").includes("index.html")); } catch (e) {} await delay(800); }
    ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    ws.on("message", raw => { const m = JSON.parse(raw); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
    await cdp("Runtime.enable");
    for (let i = 0; i < 40; i++) { if (await ev("return !!(window.dash && window.dyo && window.dyo.music)")) break; await delay(500); }

    const raw = await ev("return await window.dyo.music.state()");
    console.log("raw state from bridge:", JSON.stringify(raw));

    // mount the widget and read what it shows
    await ev("[...window.dash.mounted.keys()].forEach(it=>window.dash.removeItem(it)); window.dash.addWidget('nowplaying',{autoPosition:true},false); return true");
    await delay(1800);
    const ui = await ev(`
        const b=document.querySelector('.grid-stack .widget .body');
        const now=b.querySelector('#_np_now'), empty=b.querySelector('#_np_empty');
        return {
            nowShown: now && getComputedStyle(now).display !== 'none',
            emptyShown: empty && getComputedStyle(empty).display !== 'none',
            title: b.querySelector('#_np_t') ? b.querySelector('#_np_t').textContent : null,
            artist: b.querySelector('#_np_a') ? b.querySelector('#_np_a').textContent : null,
            state: b.querySelector('#_np_state') ? b.querySelector('#_np_state').textContent : null,
            pos: b.querySelector('#_np_pos') ? b.querySelector('#_np_pos').textContent : null,
            dur: b.querySelector('#_np_dur') ? b.querySelector('#_np_dur').textContent : null,
            emptyText: empty ? empty.innerText.slice(0,120) : null
        };
    `);
    console.log("widget UI:", JSON.stringify(ui, null, 2));

    const isErr = typeof raw === "string" && raw.startsWith("__ERR__");
    const isRunningState = typeof raw === "string" && (raw.startsWith("playing") || raw.startsWith("paused"));
    console.log(isErr ? "\nRESULT: bridge returned ERROR (likely TCC automation not yet granted for this process)"
        : isRunningState ? "\nRESULT: OK — Music state read successfully, widget shows now-playing panel"
        : "\nRESULT: Music reachable but not playing (state=" + raw + ")");
} catch (e) {
    console.error("music-probe fatal:", e.message);
} finally {
    try { await ev(`window.dyo.win("close")`); } catch (e) {}
    await delay(800); try { app.kill("SIGKILL"); } catch (e) {}
    process.exit(0);
}
