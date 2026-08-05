import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userData = path.join(appDir, ".smoke", "xdom-ud");
fs.rmSync(userData, { recursive: true, force: true }); fs.mkdirSync(userData, { recursive: true });
const PORT = 9397;
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
    await cdp("Runtime.enable"); await cdp("Page.enable");
    for (let i = 0; i < 60; i++) { if (await ev("return !!(window.term && window.term.activeTab && window.term.activeTab() && window.term.activeTab().focused && window.term.activeTab().focused.id)")) break; await delay(500); }
    const rep = await ev(`
        const pane = window.term.activeTab().focused, term = pane.term;
        let s=''; for (let i=1;i<=120;i++) s += ('line '+i+'\\r\\n'); term.write(s);
        await new Promise(r=>setTimeout(r,300));
        const xterm = pane.host.querySelector('.xterm');
        const walk = (el, depth=0) => { const kids=[]; for (const c of el.children) { kids.push({ cls: c.className, tag: c.tagName.toLowerCase(), sh: c.scrollHeight, ch: c.clientHeight, h: Math.round(c.getBoundingClientRect().height), ofY: getComputedStyle(c).overflowY }); } return kids; };
        const core = term._core || {};
        const dims = core._renderService && core._renderService.dimensions;
        return {
            xtermChildren: walk(xterm),
            scrollArea: (()=>{ const sa=pane.host.querySelector('.xterm-scroll-area'); return sa?{h:Math.round(sa.getBoundingClientRect().height), sh:sa.scrollHeight}:null; })(),
            cellHeight: dims && dims.css && dims.css.cell ? dims.css.cell.height : null,
            hasOnWheel: typeof term.onWheel,
        };
    `);
    console.log(JSON.stringify(rep, null, 2));
} catch (e) { console.error("xterm-dom fatal:", e.message); }
finally { try { await ev(`window.dyo.win("close")`); } catch (e) {} await delay(600); try { app.kill("SIGKILL"); } catch (e) {} try { execSync(`pkill -9 -f \"remote-debugging-port=${PORT}"`); } catch (e) {} process.exit(0); }
