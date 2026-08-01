// Validate the APWidget framework via ap-cpu: chrome (refresh/settings/collapse/
// last-updated), live values, per-core bars, history graph, range bar, and the
// collapse action.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userData = path.join(appDir, ".smoke", "apw-ud");
fs.rmSync(userData, { recursive: true, force: true });
fs.mkdirSync(userData, { recursive: true });
const PORT = 9371;
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
    ws.on("message", raw => { const m = JSON.parse(raw); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
    await cdp("Runtime.enable");
    const errs = [];
    ws.on("message", raw => { const m = JSON.parse(raw); if (m.method === "Runtime.exceptionThrown") errs.push((m.params.exceptionDetails?.exception?.description || "").slice(0, 200)); });
    for (let i = 0; i < 40; i++) { if (await ev("return !!(window.dash && window.APWidget && window.WIDGETS['ap-cpu'])")) break; await delay(500); }

    assert("APWidget loaded", await ev("return !!window.APWidget"));
    assert("ap-cpu registered", await ev("return !!window.WIDGETS['ap-cpu']"));

    await ev("[...window.dash.mounted.keys()].forEach(it=>window.dash.removeItem(it)); window.dash.addWidget('ap-cpu',{autoPosition:true},false); return true");
    await delay(3200); // ~2 update cycles

    const ui = await ev(`
        const item = document.querySelector('.grid-stack-item');
        const h = item.querySelector('header'); const b = item.querySelector('.body');
        const g = b.querySelector('canvas[data-ref="g"]');
        return {
            refreshVisible: getComputedStyle(h.querySelector('.w-refresh')).display !== 'none',
            settingsVisible: getComputedStyle(h.querySelector('.w-settings')).display !== 'none',
            hasCollapse: !!h.querySelector('.w-collapse'),
            hasClose: !!h.querySelector('.w-btn.remove'),
            updated: h.querySelector('.w-updated').textContent,
            hasRanges: !!b.querySelector('.apw-ranges'),
            rangeBtns: b.querySelectorAll('.apw-range').length,
            hasExport: !!b.querySelector('.apw-export'),
            total: b.querySelector('[data-ref="tot"]').textContent,
            barW: b.querySelector('[data-ref="totbar"]').style.width,
            cores: b.querySelectorAll('.apw-core').length,
            topRows: b.querySelectorAll('[data-ref="top"] tr').length,
            canvasW: g ? g.width : 0
        };
    `);
    console.log("ap-cpu UI:", JSON.stringify(ui, null, 2));
    assert("refresh button visible", ui.refreshVisible);
    assert("settings button visible", ui.settingsVisible);
    assert("collapse + close present", ui.hasCollapse && ui.hasClose);
    assert("last-updated populated", ui.updated && ui.updated !== "—" && ui.updated !== "");
    assert("range bar (4) + export", ui.hasRanges && ui.rangeBtns === 4 && ui.hasExport);
    assert("total load populated", ui.total !== "--" && ui.total !== "");
    assert("total bar has width", ui.barW && ui.barW !== "0%" && ui.barW !== "");
    assert("per-core bars rendered", ui.cores > 0);
    assert("top-process rows rendered", ui.topRows > 0);
    assert("history graph drawn (canvas sized)", ui.canvasW > 0);

    // collapse action
    const coll = await ev(`
        const item=document.querySelector('.grid-stack-item');
        item.querySelector('.w-collapse').click(); await new Promise(r=>setTimeout(r,250));
        const collapsed = item.classList.contains('apw-collapsed');
        const bodyHidden = getComputedStyle(item.querySelector('.body')).display === 'none';
        return { collapsed, bodyHidden };
    `);
    assert("collapse hides body", coll.collapsed && coll.bodyHidden, JSON.stringify(coll));

    assert("no uncaught exceptions", errs.length === 0, errs.join(" | "));

    console.log("");
    let ok = true;
    for (const c of checks) { console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.n}${c.d ? "  (" + c.d + ")" : ""}`); if (!c.ok) ok = false; }
    console.log(ok ? "\nAPWIDGET FRAMEWORK OK" : "\nAPWIDGET FRAMEWORK FAILED");
} catch (e) {
    console.error("apw-probe fatal:", e.message);
} finally {
    try { await ev(`window.dyo.win("close")`); } catch (e) {}
    await delay(800); try { app.kill("SIGKILL"); } catch (e) {}
    process.exit(0);
}
