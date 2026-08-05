// Diagnose terminal scrolling + Ctrl+L/clear scrollback behavior. Writes lines to
// the pane's xterm buffer (no shell interaction), then probes scrollback size,
// wheel scrolling, viewport overflow, and what ESC[3J (clear-scrollback, what
// `clear`/Ctrl+L emit) does to the buffer. Read-only diagnostic.
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userData = path.join(appDir, ".smoke", "scroll-ud");
fs.rmSync(userData, { recursive: true, force: true }); fs.mkdirSync(userData, { recursive: true });
const PORT = 9396;
const app = spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", `--remote-debugging-port=${PORT}`], {
    cwd: appDir, env: { ...process.env, DYOTERM_USER_DATA: userData, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" }, stdio: ["ignore", "ignore", "ignore"]
});
const delay = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(); const errs = [];
const cdp = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); setTimeout(() => pend.has(i) && (pend.delete(i), rej(new Error("timeout " + m))), 20000); });
const ev = (e) => cdp("Runtime.evaluate", { expression: `(async()=>{${e}})()`, returnByValue: true, awaitPromise: true }).then(r => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; });
try {
    let target = null;
    for (let i = 0; i < 50 && !target; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = l.find(t => t.type === "page" && (t.url || "").includes("index.html")); } catch (e) {} await delay(800); }
    ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    ws.on("message", raw => { const m = JSON.parse(raw); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } else if (m.method === "Runtime.exceptionThrown") errs.push((m.params.exceptionDetails?.exception?.description || "").slice(0, 160)); });
    await cdp("Runtime.enable"); await cdp("Page.enable");
    for (let i = 0; i < 60; i++) { if (await ev("return !!(window.term && window.term.activeTab && window.term.activeTab() && window.term.activeTab().focused && window.term.activeTab().focused.id)")) break; await delay(500); }

    const rep = await ev(`
        const pane = window.term.activeTab().focused;
        const term = pane.term;
        // fill the buffer well past one screen
        let s=''; for (let i=1;i<=120;i++) s += ('line '+i+'\\r\\n');
        term.write(s);
        await new Promise(r=>setTimeout(r,300));
        const b = () => term.buffer.active;
        const vp = pane.host.querySelector('.xterm-viewport');
        const cs = vp ? getComputedStyle(vp) : null;
        const before = { rows: term.rows, len: b().length, baseY: b().baseY, viewportY: b().viewportY };

        // programmatic scroll to top
        term.scrollToTop();
        await new Promise(r=>setTimeout(r,120));
        const afterScrollTop = { viewportY: b().viewportY, vpScrollTop: vp ? vp.scrollTop : null };

        // wheel scroll test (from bottom)
        term.scrollToBottom(); await new Promise(r=>setTimeout(r,80));
        const vy0 = b().viewportY, st0 = vp ? vp.scrollTop : null;
        if (vp) vp.dispatchEvent(new WheelEvent('wheel',{deltaY:-300,deltaMode:0,bubbles:true,cancelable:true}));
        await new Promise(r=>setTimeout(r,150));
        const vy1 = b().viewportY, st1 = vp ? vp.scrollTop : null;

        // ESC[3J (what modern clear / Ctrl+L emit) — does it wipe scrollback?
        term.scrollToBottom();
        const lenBefore3J = b().length, baseYBefore3J = b().baseY;
        term.write('\\x1b[H\\x1b[2J\\x1b[3J');
        await new Promise(r=>setTimeout(r,150));
        const after3J = { len: b().length, baseY: b().baseY };

        return {
            before,
            overflowY: cs ? cs.overflowY : '(no viewport el)',
            viewportExists: !!vp,
            vpMetrics: vp ? { scrollHeight: vp.scrollHeight, clientHeight: vp.clientHeight } : null,
            afterScrollTop,
            wheel: { viewportY_before: vy0, viewportY_after: vy1, scrolled: vy1 < vy0, scrollTop_before: st0, scrollTop_after: st1 },
            clear3J: { lenBefore: lenBefore3J, baseYBefore: baseYBefore3J, lenAfter: after3J.len, baseYAfter: after3J.baseY, wipedScrollback: after3J.baseY < baseYBefore3J }
        };
    `);
    console.log(JSON.stringify(rep, null, 2));
    console.log("console errors:", errs.length ? errs.slice(0, 6).join(" | ") : "(none)");
} catch (e) { console.error("scroll-diag fatal:", e.message); }
finally { try { await ev(`window.dyo.win("close")`); } catch (e) {} await delay(600); try { app.kill("SIGKILL"); } catch (e) {} try { execSync(`pkill -9 -f \"remote-debugging-port=${PORT}"`); } catch (e) {} process.exit(0); }
