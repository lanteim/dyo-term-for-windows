// Regression test for B1: after closing a split, the survivor pane must not keep
// a stale inline flex from the splitter (terminal.js _render leaf branch clears it).
// Checks, each on a fresh tab with its own baseline:
//   1. vertical split -> closeFocusedPane -> survivor full width, cols back to baseline
//   2. vertical split -> ratio 0.15/0.85 -> close big pane -> survivor (was 15%) full width
//   3. horizontal split -> close -> survivor full height, rows back to baseline
//   4. shell-exit path: split, type "exit\n" into the pty -> onPaneExit -> survivor full width
//   5. zero uncaught console errors / exceptions
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userData = path.join(appDir, ".smoke", "sgeo-ud");
fs.rmSync(userData, { recursive: true, force: true });
fs.mkdirSync(userData, { recursive: true });
const PORT = 9407;
const reap = () => { try { execSync(`pkill -9 -f "remote-debugging-port=${PORT}"`); } catch (e) {} };
reap(); // never attach to a straggler from a previous run

const app = spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", `--remote-debugging-port=${PORT}`], {
    cwd: appDir,
    env: { ...process.env, DYOTERM_USER_DATA: userData, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" },
    stdio: ["ignore", "ignore", "ignore"]
});

const delay = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0;
const pend = new Map();
const errs = [];
const cdp = (m, p = {}) => new Promise((res, rej) => {
    const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
    setTimeout(() => { if (pend.has(i)) { pend.delete(i); rej(new Error("timeout " + m)); } }, 20000);
});
const ev = async (expr, awaitPromise = false) => {
    const r = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result?.value;
};
const waitFor = async (expr, ms, label) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { try { if (await ev(expr)) return true; } catch (e) {} await delay(400); }
    throw new Error("timeout waiting: " + (label || expr));
};

let pass = true;
const check = (name, cond, extra) => {
    console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  (" + extra + ")" : ""));
    if (!cond) pass = false;
};

const MEASURE = `(() => {
  const t = window.term.activeTab();
  const p = t.focused;
  const host = document.getElementById('panes');
  const r = p.el.getBoundingClientRect();
  const hr = host.getBoundingClientRect();
  return {
    panes: t.panes().length,
    inlineFlex: p.el.style.flex,
    fracW: +(r.width / hr.width).toFixed(3),
    fracH: +(r.height / hr.height).toFixed(3),
    cols: p.term.cols, rows: p.term.rows
  };
})()`;

const freshTab = async () => { await ev(`window.term.newTab()`); await delay(1500); return ev(MEASURE); };

try {
    let target = null;
    for (let i = 0; i < 50 && !target; i++) {
        try {
            const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
            target = list.find(t => t.type === "page" && (t.url || "").includes("index.html"));
        } catch (e) {}
        await delay(1000);
    }
    if (!target) throw new Error("no page target on port " + PORT);
    ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    ws.on("message", raw => {
        const m = JSON.parse(raw);
        if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
        else if (m.method === "Runtime.exceptionThrown") errs.push("EXC " + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || "").slice(0, 200));
        else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errs.push("ERR " + m.params.args.map(a => a.value ?? a.description ?? "").join(" ").slice(0, 200));
    });
    await cdp("Runtime.enable");
    await cdp("Page.enable");

    await waitFor("!!(window.term && window.term.activeTab && window.term.activeTab() && window.term.activeTab().focused && window.term.activeTab().focused.id)", 30000, "boot");
    await delay(1500);

    // ---------- 1) vertical split -> close -> survivor full width ----------
    const b1 = await ev(MEASURE);
    await ev(`window.term.splitFocused("vertical")`);
    await delay(900);
    const s1 = await ev(MEASURE);
    await ev(`window.term.closeFocusedPane()`);
    await delay(1200);
    const r1 = await ev(MEASURE);
    check("1a split actually happened (2 panes, narrower)", s1.panes === 2 && s1.fracW < 0.95, `panes=${s1.panes} fracW=${s1.fracW}`);
    check("1b survivor inline flex cleared", r1.inlineFlex === "", JSON.stringify(r1.inlineFlex));
    check("1c survivor full width (>=95%)", r1.panes === 1 && r1.fracW >= 0.95, `fracW=${r1.fracW}`);
    check("1d cols back to baseline", r1.cols === b1.cols, `${b1.cols} -> ${r1.cols}`);

    // ---------- 2) vertical split at 0.15/0.85 -> close big pane -> 15% survivor heals ----------
    await freshTab();
    await ev(`window.term.splitFocused("vertical")`);
    await delay(900);
    await ev(`(()=>{const t=window.term.activeTab(); t.root.sizes=[0.15,0.85]; t._mount();})()`);
    await delay(900);
    const s2 = await ev(`(()=>{const t=window.term.activeTab(); const p=t.panes()[0]; const hr=document.getElementById('panes').getBoundingClientRect(); return +(p.el.getBoundingClientRect().width/hr.width).toFixed(3);})()`);
    await ev(`(()=>{const t=window.term.activeTab(); window.term.focusPane(t.panes()[1]);})()`);
    await ev(`window.term.closeFocusedPane()`);
    await delay(1200);
    const r2 = await ev(MEASURE);
    check("2a ratio applied before close (pane A ~15%)", s2 < 0.30, `fracW=${s2}`);
    check("2b survivor inline flex cleared", r2.inlineFlex === "", JSON.stringify(r2.inlineFlex));
    check("2c survivor full width (>=95%)", r2.panes === 1 && r2.fracW >= 0.95, `fracW=${r2.fracW}`);

    // ---------- 3) horizontal split -> close -> survivor full height ----------
    const b3 = await freshTab();
    await ev(`window.term.splitFocused("horizontal")`);
    await delay(900);
    const s3 = await ev(MEASURE);
    await ev(`window.term.closeFocusedPane()`);
    await delay(1200);
    const r3 = await ev(MEASURE);
    check("3a horizontal split happened (2 panes, shorter)", s3.panes === 2 && s3.fracH < 0.95, `panes=${s3.panes} fracH=${s3.fracH}`);
    check("3b survivor inline flex cleared", r3.inlineFlex === "", JSON.stringify(r3.inlineFlex));
    check("3c survivor full height (>=95%)", r3.panes === 1 && r3.fracH >= 0.95, `fracH=${r3.fracH}`);
    check("3d rows back to baseline", r3.rows === b3.rows, `${b3.rows} -> ${r3.rows}`);

    // ---------- 4) shell-exit path: `exit` in split pane -> onPaneExit -> survivor heals ----------
    const b4 = await freshTab();
    await ev(`window.term.splitFocused("vertical")`);
    await delay(1500);
    await ev(`window.dyo.pty.input(window.term.activeTab().focused.id, "exit\\n")`);
    await waitFor(`window.term.activeTab().panes().length === 1`, 15000, "pane exited via shell exit");
    await delay(1200);
    const r4 = await ev(MEASURE);
    check("4a survivor inline flex cleared (onPaneExit)", r4.inlineFlex === "", JSON.stringify(r4.inlineFlex));
    check("4b survivor full width (>=95%)", r4.fracW >= 0.95, `fracW=${r4.fracW}`);
    check("4c cols back to baseline", r4.cols === b4.cols, `${b4.cols} -> ${r4.cols}`);

    // ---------- 5) console hygiene ----------
    check("5  no uncaught console errors/exceptions", errs.length === 0, errs.length ? errs.slice(0, 4).join(" | ") : "0");
} catch (e) {
    console.error("split-geometry fatal:", e.message);
    pass = false;
} finally {
    try { await ev(`window.dyo.win("close")`); } catch (e) {}
    await delay(600);
    try { ws && ws.close(); } catch (e) {}
    try { app.kill("SIGKILL"); } catch (e) {}
    reap();
    await delay(500);
    console.log(pass ? "\nALL PASS" : "\nFAILED");
    process.exit(pass ? 0 : 1);
}
