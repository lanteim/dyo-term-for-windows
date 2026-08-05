// Regression test for the double-paste bug: a single ⌘V surfaces BOTH a keydown
// (our custom handler) and a native `paste` event (which xterm would also handle).
// We simulate both and assert the text reaches the pty exactly once. Also checks the
// multiline guard shows one dialog, and the guardedPaste dedupe collapses a rapid
// double call. No real clipboard needed — synthetic ClipboardEvent carries the text.
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userData = path.join(appDir, ".smoke", "paste-ud");
fs.rmSync(userData, { recursive: true, force: true }); fs.mkdirSync(userData, { recursive: true });
const PORT = 9394;
const app = spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", `--remote-debugging-port=${PORT}`], {
    cwd: appDir, env: { ...process.env, DYOTERM_USER_DATA: userData, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" }, stdio: ["ignore", "ignore", "ignore"]
});
const delay = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(); const errs = [];
const cdp = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); setTimeout(() => pend.has(i) && (pend.delete(i), rej(new Error("timeout " + m))), 20000); });
const ev = (e) => cdp("Runtime.evaluate", { expression: `(async()=>{${e}})()`, returnByValue: true, awaitPromise: true }).then(r => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; });
let pass = true;
const check = (name, cond) => { console.log((cond ? "PASS " : "FAIL ") + name); if (!cond) pass = false; };
try {
    let target = null;
    for (let i = 0; i < 50 && !target; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = l.find(t => t.type === "page" && (t.url || "").includes("index.html")); } catch (e) {} await delay(800); }
    ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    ws.on("message", raw => { const m = JSON.parse(raw); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } else if (m.method === "Runtime.exceptionThrown") errs.push((m.params.exceptionDetails?.exception?.description || "").slice(0, 160)); });
    await cdp("Runtime.enable"); await cdp("Page.enable");
    // wait until a terminal pane has spawned its pty
    for (let i = 0; i < 60; i++) { if (await ev("return !!(window.term && window.term.activeTab && window.term.activeTab() && window.term.activeTab().focused && window.term.activeTab().focused.id)")) break; await delay(500); }

    const plat = await ev("return window.__PLATFORM");
    console.log("platform:", plat);

    // 1) short single-line paste — simulate the keydown + native paste event a real ⌘V emits
    const c1 = await ev(`
        const MARK='DYO_PASTE_ONCE_9x7';
        const pane = window.term.activeTab().focused;
        window.__pc = 0;
        pane.term.onData(d => { if (d.indexOf(MARK) >= 0) window.__pc++; });
        pane.focus();
        const ta = pane.host.querySelector('.xterm-helper-textarea') || document.querySelector('.xterm-helper-textarea');
        const dt = new DataTransfer(); dt.setData('text', MARK);
        ta.dispatchEvent(new KeyboardEvent('keydown',{key:'v',code:'KeyV',metaKey:true,ctrlKey:false,shiftKey:false,bubbles:true,cancelable:true}));
        ta.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));
        await new Promise(r=>setTimeout(r,250));
        return window.__pc;
    `);
    console.log("short paste → pty writes:", c1);
    check("single-line ⌘V pastes exactly once", c1 === 1);

    // 2) multiline paste → exactly one guard dialog, nothing pasted yet
    const m = await ev(`
        const MARK2='DYO_PASTE_MULTI_4x2';
        const pane = window.term.activeTab().focused;
        window.__pc2 = 0;
        pane.term.onData(d => { if (d.indexOf(MARK2) >= 0) window.__pc2++; });
        pane.focus();
        const ta = pane.host.querySelector('.xterm-helper-textarea') || document.querySelector('.xterm-helper-textarea');
        const dt = new DataTransfer(); dt.setData('text', 'L1\\n'+MARK2+'\\nL3');
        ta.dispatchEvent(new KeyboardEvent('keydown',{key:'v',code:'KeyV',metaKey:true,bubbles:true,cancelable:true}));
        ta.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));
        await new Promise(r=>setTimeout(r,250));
        const dialogs = document.querySelectorAll('.paste-guard.open').length;
        const wrote = window.__pc2;
        // clean up: confirm the dialog so it pastes once, then verify
        const ok = document.querySelector('.paste-guard.open .pg-ok'); if (ok) ok.click();
        await new Promise(r=>setTimeout(r,150));
        return { dialogs, wroteBeforeConfirm: wrote, wroteAfterConfirm: window.__pc2 };
    `);
    console.log("multiline:", JSON.stringify(m));
    check("multiline shows exactly one guard dialog", m.dialogs === 1);
    check("multiline not pasted before confirm", m.wroteBeforeConfirm === 0);
    check("multiline pasted once after confirm", m.wroteAfterConfirm === 1);

    // 3) dedupe: two rapid identical guardedPaste calls (the win/linux belt-and-suspenders path)
    const c3 = await ev(`
        const MARK3='DYO_PASTE_DEDUP_5x5';
        const pane = window.term.activeTab().focused;
        window.__pc3 = 0;
        pane.term.onData(d => { if (d.indexOf(MARK3) >= 0) window.__pc3++; });
        window.term.guardedPaste(pane, MARK3);
        window.term.guardedPaste(pane, MARK3);
        await new Promise(r=>setTimeout(r,200));
        return window.__pc3;
    `);
    console.log("rapid double guardedPaste → pty writes:", c3);
    check("dedupe collapses a rapid identical double to one", c3 === 1);

    check("no uncaught console errors", errs.length === 0);
    if (errs.length) console.log("errors:", errs.slice(0, 6).join(" | "));
} catch (e) { console.error("paste-dbl fatal:", e.message); pass = false; }
finally { try { await ev(`window.dyo.win("close")`); } catch (e) {} await delay(600); try { app.kill("SIGKILL"); } catch (e) {} try { execSync(`pkill -9 -f \"remote-debugging-port=${PORT}"`); } catch (e) {} console.log(pass ? "\nALL PASS" : "\nFAILED"); process.exit(pass ? 0 : 1); }
