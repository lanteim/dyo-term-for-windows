// Validate 4-side docking + layout profiles (uses the default widgets).
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userData = path.join(appDir, ".smoke", "dock-ud");
fs.rmSync(userData, { recursive: true, force: true });
fs.mkdirSync(userData, { recursive: true });
const PORT = 9372;
const app = spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", `--remote-debugging-port=${PORT}`], {
    cwd: appDir, env: { ...process.env, DYOTERM_USER_DATA: userData, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" }, stdio: ["ignore", "ignore", "ignore"]
});
const delay = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map();
const cdp = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); setTimeout(() => pend.has(i) && (pend.delete(i), rej(new Error("timeout " + m))), 20000); });
const ev = (e) => cdp("Runtime.evaluate", { expression: `(async()=>{${e}})()`, returnByValue: true, awaitPromise: true }).then(r => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; });
const checks = []; const assert = (n, c, d = "") => checks.push({ n, ok: !!c, d });
try {
    let target = null;
    for (let i = 0; i < 50 && !target; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = l.find(t => t.type === "page" && (t.url || "").includes("index.html")); } catch (e) {} await delay(800); }
    ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    const errs = [];
    ws.on("message", raw => { const m = JSON.parse(raw); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } else if (m.method === "Runtime.exceptionThrown") errs.push((m.params.exceptionDetails?.exception?.description || "").slice(0, 160)); });
    await cdp("Runtime.enable");
    for (let i = 0; i < 40; i++) { if (await ev("return !!(window.dash && document.getElementById('dock-btn'))")) break; await delay(500); }
    await delay(600);

    assert("default dock = right", await ev("return document.body.classList.contains('dock-right')"));

    // cycle dock: right -> bottom -> left -> top -> right
    const seq = ["bottom", "left", "top", "right"];
    for (const pos of seq) {
        await ev("document.getElementById('dock-btn').click(); return true"); await delay(300);
        const info = await ev(`return { cls: document.body.className.match(/dock-\\w+/)[0], dir: getComputedStyle(document.getElementById('main')).flexDirection }`);
        const expDir = pos === "bottom" ? "column" : pos === "top" ? "column-reverse" : pos === "left" ? "row-reverse" : "row";
        assert("dock " + pos + " (class+flex)", info.cls === "dock-" + pos && info.dir === expDir, JSON.stringify(info));
    }

    // widgets still present and terminal visible after cycling
    assert("widgets survive dock cycling", await ev("return window.dash.mounted.size > 0"));
    assert("terminal visible", await ev("return document.querySelector('.pane .xterm-host') && document.querySelector('.pane .xterm-host').offsetWidth > 0"));

    // ---- layout profiles ----
    const startCount = await ev("return window.dash.mounted.size");
    assert("starts with Default layout", await ev("return window.dash.listLayouts().length === 1 && window.dash.activeLayout === 'Default'"));
    // create a new layout programmatically (the menu just calls this)
    await ev("window.dash.newLayout('Monitoring'); return true"); await delay(300);
    assert("new layout is active + empty", await ev("return window.dash.activeLayout === 'Monitoring' && window.dash.mounted.size === 0"), "count=" + await ev("return window.dash.mounted.size"));
    assert("two layouts exist", await ev("return window.dash.listLayouts().length === 2"));
    // add a widget to Monitoring, then switch away and back — should persist
    await ev("window.dash.addWidget('clock',{autoPosition:true},true); return true"); await delay(200);
    const monCount = await ev("return window.dash.mounted.size");
    await ev("window.dash.switchLayout('Default'); return true"); await delay(300);
    assert("switch back to Default restores its widgets", await ev("return window.dash.mounted.size === " + startCount), "def=" + await ev("return window.dash.mounted.size"));
    await ev("window.dash.switchLayout('Monitoring'); return true"); await delay(300);
    assert("Monitoring layout kept its widget", await ev("return window.dash.mounted.size === " + monCount));
    // menu renders
    await ev("document.getElementById('layouts-btn').click(); return true"); await delay(200);
    assert("layout menu opens with rows", await ev("return !!document.querySelector('.popmenu') && document.querySelectorAll('.popmenu-row').length === 2"));
    await ev("document.getElementById('layouts-btn').click(); return true");
    // delete
    await ev("window.dash.deleteLayout('Monitoring'); return true"); await delay(200);
    assert("delete layout works", await ev("return window.dash.listLayouts().length === 1"));

    assert("no uncaught exceptions", errs.length === 0, errs.join(" | "));

    console.log("");
    let ok = true;
    for (const c of checks) { console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.n}${c.d ? "  (" + c.d + ")" : ""}`); if (!c.ok) ok = false; }
    console.log(ok ? "\nDOCK + LAYOUTS OK" : "\nDOCK + LAYOUTS FAILED");
} catch (e) {
    console.error("dock-probe fatal:", e.message);
} finally {
    try { await ev(`window.dyo.win("close")`); } catch (e) {}
    await delay(800); try { app.kill("SIGKILL"); } catch (e) {} try { execSync(`pkill -9 -f \"remote-debugging-port=${PORT}"`); } catch (e) {}
    process.exit(0);
}
