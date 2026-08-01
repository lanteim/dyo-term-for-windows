// Verify the notAvailable() → recovery fix: a widget that degrades on tick 1 must
// rebuild its DOM and show data on tick 2 (mirrors ap-services/ap-logs recovering
// after the active tab switches to an SSH host where the tool exists).
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userData = path.join(appDir, ".smoke", "rec-ud");
fs.rmSync(userData, { recursive: true, force: true }); fs.mkdirSync(userData, { recursive: true });
const PORT = 9375;
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
    for (let i = 0; i < 40; i++) { if (await ev("return !!(window.dash && window.APWidget)")) break; await delay(500); }

    // define a widget that degrades on tick 1, then serves data
    await ev(`
        window.APWidget.define({
            id: '__rec', title: 'widget.sysmon', category: 'apetrov', interval: 400,
            render(ctx){ ctx.body.innerHTML = '<b data-ref="v">--</b>'; },
            update(ctx){ ctx._n = (ctx._n||0)+1; if (ctx._n === 1) { ctx.notAvailable('degraded once'); return; } ctx.ref.v.textContent = 'RECOVERED-' + ctx._n; }
        });
        [...window.dash.mounted.keys()].forEach(it=>window.dash.removeItem(it));
        window.dash.addWidget('__rec',{autoPosition:true},false);
        return true;
    `);
    await delay(300);
    const t1 = await ev(`return document.querySelector('.grid-stack .widget .body').innerText.slice(0,40)`);
    await delay(1600); // several ticks
    const t2 = await ev(`return document.querySelector('.grid-stack .widget .body').innerText.slice(0,40)`);
    console.log("early:", JSON.stringify(t1));
    console.log("final:", JSON.stringify(t2));
    // The <b data-ref="v"> node was destroyed by notAvailable(); seeing RECOVERED-N
    // means the runtime rebuilt the DOM and re-bound ctx.ref.v. Pre-fix it would be
    // stuck showing the "degraded once" apw-na div forever.
    const ok = t2.includes("RECOVERED") && !t2.includes("degraded");
    console.log(ok ? "\nPASS — widget recovers from notAvailable (DOM rebuilt + refs re-bound)" : "\nFAIL — widget stuck after notAvailable");
} catch (e) { console.error("recover fatal:", e.message); }
finally { try { await ev(`window.dyo.win("close")`); } catch (e) {} await delay(600); try { app.kill("SIGKILL"); } catch (e) {} process.exit(0); }
