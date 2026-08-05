// Verify the v0.5.4 terminal fixes:
//   1. wheel scrolls the scrollback (normal buffer),
//   2. wheel is NOT hijacked in the alt buffer (vim/less/htop),
//   3. ESC[3J (clear/Ctrl+L) preserves scrollback,
//   4. tab label comes from cwd basename / OSC title, not "shell".
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userData = path.join(appDir, ".smoke", "sfix-ud");
fs.rmSync(userData, { recursive: true, force: true }); fs.mkdirSync(userData, { recursive: true });
const PORT = 9398;
const app = spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", `--remote-debugging-port=${PORT}`], {
    cwd: appDir, env: { ...process.env, DYOTERM_USER_DATA: userData, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" }, stdio: ["ignore", "ignore", "ignore"]
});
const delay = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(); const errs = [];
const cdp = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); setTimeout(() => pend.has(i) && (pend.delete(i), rej(new Error("timeout " + m))), 20000); });
const ev = (e) => cdp("Runtime.evaluate", { expression: `(async()=>{${e}})()`, returnByValue: true, awaitPromise: true }).then(r => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; });
let pass = true;
const check = (name, cond, extra) => { console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  (" + extra + ")" : "")); if (!cond) pass = false; };
try {
    let target = null;
    for (let i = 0; i < 50 && !target; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = l.find(t => t.type === "page" && (t.url || "").includes("index.html")); } catch (e) {} await delay(800); }
    ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    ws.on("message", raw => { const m = JSON.parse(raw); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } else if (m.method === "Runtime.exceptionThrown") errs.push((m.params.exceptionDetails?.exception?.description || "").slice(0, 160)); });
    await cdp("Runtime.enable"); await cdp("Page.enable");
    for (let i = 0; i < 60; i++) { if (await ev("return !!(window.term && window.term.activeTab && window.term.activeTab() && window.term.activeTab().focused && window.term.activeTab().focused.id)")) break; await delay(500); }

    // 1) wheel scrolls the scrollback
    const w = await ev(`
        const pane = window.term.activeTab().focused, term = pane.term;
        let s=''; for (let i=1;i<=120;i++) s += ('line '+i+'\\r\\n'); term.write(s);
        await new Promise(r=>setTimeout(r,300));
        term.scrollToBottom();
        const before = term.buffer.active.viewportY;
        pane.host.dispatchEvent(new WheelEvent('wheel',{deltaY:-300,deltaMode:0,bubbles:true,cancelable:true}));
        await new Promise(r=>setTimeout(r,120));
        const afterUp = term.buffer.active.viewportY;
        pane.host.dispatchEvent(new WheelEvent('wheel',{deltaY:300,deltaMode:0,bubbles:true,cancelable:true}));
        await new Promise(r=>setTimeout(r,120));
        const afterDown = term.buffer.active.viewportY;
        return { before, afterUp, afterDown };
    `);
    check("wheel up scrolls back into history", w.afterUp < w.before, `${w.before} → ${w.afterUp}`);
    check("wheel down scrolls toward bottom", w.afterDown > w.afterUp, `${w.afterUp} → ${w.afterDown}`);

    // 2) alt buffer: wheel must NOT be hijacked (viewportY unchanged)
    const a = await ev(`
        const pane = window.term.activeTab().focused, term = pane.term;
        term.write('\\x1b[?1049h');           // enter alt screen
        await new Promise(r=>setTimeout(r,80));
        const isAlt = term.buffer.active.type;
        const vy0 = term.buffer.active.viewportY;
        pane.host.dispatchEvent(new WheelEvent('wheel',{deltaY:-300,deltaMode:0,bubbles:true,cancelable:true}));
        await new Promise(r=>setTimeout(r,100));
        const vy1 = term.buffer.active.viewportY;
        term.write('\\x1b[?1049l');           // back to normal
        return { isAlt, changed: vy0 !== vy1 };
    `);
    check("in alt buffer, buffer type is 'alternate'", a.isAlt === "alternate", a.isAlt);
    check("in alt buffer, wheel is left to the app", a.changed === false);

    // 3) ESC[3J preserves scrollback
    const c = await ev(`
        const term = window.term.activeTab().focused.term;
        term.scrollToBottom();
        const baseYBefore = term.buffer.active.baseY;
        term.write('\\x1b[H\\x1b[2J\\x1b[3J');
        await new Promise(r=>setTimeout(r,120));
        return { baseYBefore, baseYAfter: term.buffer.active.baseY };
    `);
    check("ESC[3J keeps scrollback (clear/Ctrl+L no longer wipes it)", c.baseYAfter === c.baseYBefore, `${c.baseYBefore} → ${c.baseYAfter}`);

    // 4) tab label: cwd basename / OSC, never "shell", never "1: shell"
    const t = await ev(`
        const term = window.term;
        const label0 = term.tabLabel(term.activeTab());
        // now set an OSC title and confirm it wins
        term.activeTab().focused.term.write('\\x1b]0;MyProc\\x07');
        await new Promise(r=>setTimeout(r,80));
        const label1 = term.tabLabel(term.activeTab());
        return { label0, label1 };
    `);
    check("cwd-based label is not the old 'shell' placeholder", t.label0 !== "shell" && !/^\\d+:/.test(t.label0), JSON.stringify(t.label0));
    check("OSC title becomes the tab label", t.label1 === "MyProc", JSON.stringify(t.label1));

    check("no uncaught console errors", errs.length === 0);
    if (errs.length) console.log("errors:", errs.slice(0, 6).join(" | "));
} catch (e) { console.error("scroll-fix fatal:", e.message); pass = false; }
finally { try { await ev(`window.dyo.win("close")`); } catch (e) {} await delay(600); try { app.kill("SIGKILL"); } catch (e) {} try { execSync(`pkill -9 -f \"remote-debugging-port=${PORT}"`); } catch (e) {} console.log(pass ? "\nALL PASS" : "\nFAILED"); process.exit(pass ? 0 : 1); }
