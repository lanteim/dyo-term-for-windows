// Diagnose the "terminal won't go full-width" complaint: measure #terminal-col
// width vs #main width across states (default, dash-collapsed, after divider
// drag, after removing all widgets, then collapsed again).
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userData = path.join(appDir, ".smoke", "layout-ud");
fs.rmSync(userData, { recursive: true, force: true });
fs.mkdirSync(userData, { recursive: true });
const PORT = 9368;
const app = spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", `--remote-debugging-port=${PORT}`], {
    cwd: appDir, env: { ...process.env, DYOTERM_USER_DATA: userData, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" }, stdio: ["ignore", "ignore", "ignore"]
});
const delay = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map();
const cdp = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); setTimeout(() => pend.has(i) && (pend.delete(i), rej(new Error("timeout " + m))), 20000); });
const ev = (e) => cdp("Runtime.evaluate", { expression: `(async()=>{${e}})()`, returnByValue: true, awaitPromise: true }).then(r => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; });
const measure = () => ev(`
    const main = document.getElementById('main').getBoundingClientRect();
    const tcol = document.getElementById('terminal-col').getBoundingClientRect();
    const dcol = document.getElementById('dash-col');
    const host = document.querySelector('.pane .xterm-host');
    const cols = window.term && window.term.activeTab && window.term.activeTab() ? (window.term.activeTab().focused?.term?.cols) : null;
    return {
        mainW: Math.round(main.width),
        tcolW: Math.round(tcol.width),
        tcolPct: Math.round(tcol.width / main.width * 100),
        dashVisible: dcol ? getComputedStyle(dcol).display !== 'none' : null,
        tcolInlineFlex: document.getElementById('terminal-col').style.flex || '(none)',
        hostW: host ? Math.round(host.getBoundingClientRect().width) : null,
        cols
    };
`);
try {
    let target = null;
    for (let i = 0; i < 50 && !target; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = l.find(t => t.type === "page" && (t.url || "").includes("index.html")); } catch (e) {} await delay(800); }
    ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    ws.on("message", raw => { const m = JSON.parse(raw); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
    await cdp("Runtime.enable");
    for (let i = 0; i < 40; i++) { if (await ev("return !!(window.dash && window.term && document.querySelector('.pane .xterm-host'))")) break; await delay(500); }
    await delay(600);

    console.log("1. default:            ", JSON.stringify(await measure()));

    // collapse dashboard via the grid button
    await ev("document.getElementById('dash-btn').click(); return true"); await delay(400);
    console.log("2. after collapse:     ", JSON.stringify(await measure()));

    // expand again
    await ev("document.getElementById('dash-btn').click(); return true"); await delay(400);
    console.log("3. after expand:       ", JSON.stringify(await measure()));

    // drag divider hard left (make terminal small), then collapse
    await ev(`
        const main=document.getElementById('main').getBoundingClientRect();
        const div=document.getElementById('main-divider');
        div.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,clientX:main.left+main.width*0.7,clientY:main.top+100}));
        document.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:main.left+main.width*0.3,clientY:main.top+100}));
        document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
        return true;
    `); await delay(300);
    console.log("4. after divider drag: ", JSON.stringify(await measure()));

    await ev("document.getElementById('dash-btn').click(); return true"); await delay(400);
    console.log("5. dragged+collapsed:  ", JSON.stringify(await measure()));

    // expand, then remove ALL widgets (edit-mode remove) and see if terminal grows
    await ev("document.getElementById('dash-btn').click(); return true"); await delay(300);
    await ev("[...window.dash.mounted.keys()].forEach(it => window.dash.removeItem(it)); return true"); await delay(400);
    console.log("6. all widgets removed:", JSON.stringify(await measure()));

    console.log("\nExpectation: states 2 and 5 (collapsed) should have tcolPct ~100 and cols noticeably larger than default.");
} catch (e) {
    console.error("layout-probe fatal:", e.message);
} finally {
    try { await ev(`window.dyo.win("close")`); } catch (e) {}
    await delay(800); try { app.kill("SIGKILL"); } catch (e) {} try { execSync(`pkill -9 -f \"remote-debugging-port=${PORT}"`); } catch (e) {}
    process.exit(0);
}
