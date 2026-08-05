// Verify the System Overview easter egg: mount ap-system, tap the HOST header
// 7×, confirm the A.Petrov credit banner reveals, and screenshot it. Local data only.
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userData = path.join(appDir, ".smoke", "egg-ud");
fs.rmSync(userData, { recursive: true, force: true }); fs.mkdirSync(userData, { recursive: true });
const PORT = 9391;
const app = spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", `--remote-debugging-port=${PORT}`], {
    cwd: appDir, env: { ...process.env, DYOTERM_USER_DATA: userData, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" }, stdio: ["ignore", "ignore", "ignore"]
});
const delay = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(); const errs = [];
const cdp = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); setTimeout(() => pend.has(i) && (pend.delete(i), rej(new Error("timeout " + m))), 20000); });
const ev = (e) => cdp("Runtime.evaluate", { expression: `(async()=>{${e}})()`, returnByValue: true, awaitPromise: true }).then(r => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; });
async function shot(file, clip) { const r = await cdp("Page.captureScreenshot", { format: "png", clip: clip ? { ...clip, scale: 1 } : undefined }); fs.writeFileSync(file, Buffer.from(r.data, "base64")); }
let okReveal = false;
try {
    let target = null;
    for (let i = 0; i < 50 && !target; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = l.find(t => t.type === "page" && (t.url || "").includes("index.html")); } catch (e) {} await delay(800); }
    ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    ws.on("message", raw => { const m = JSON.parse(raw); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } else if (m.method === "Runtime.exceptionThrown") errs.push((m.params.exceptionDetails?.exception?.description || "").slice(0, 160)); });
    await cdp("Runtime.enable"); await cdp("Page.enable");
    await cdp("Emulation.setDeviceMetricsOverride", { width: 900, height: 800, deviceScaleFactor: 2, mobile: false });
    for (let i = 0; i < 40; i++) { if (await ev("return !!(window.dash && window.WIDGETS['ap-system'])")) break; await delay(500); }

    await ev("if(window.__setDock)window.__setDock('bottom'); [...window.dash.mounted.keys()].forEach(it=>window.dash.removeItem(it)); window.dash.addWidget('ap-system',{x:0,y:0,w:8,h:8},false); return true");
    await delay(1500);

    // hidden before taps
    const before = await ev(`return !!document.querySelector('.apw-egg.show')`);
    // tap HOST header 7×
    await ev(`const h=document.querySelector('.grid-stack .widget [data-ref="hostHdr"]'); for(let i=0;i<7;i++){ h.click(); } return true`);
    await delay(700);
    okReveal = await ev(`const e=document.querySelector('.apw-egg.show'); return !!e && /A[·. ]?PETROV/i.test(e.textContent)`);
    console.log("egg hidden before taps:", !before, "| revealed after 7 taps:", okReveal);

    const rect = await ev(`const b=document.querySelector('.grid-stack .widget'); const r=b.getBoundingClientRect(); return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}`);
    await shot("/tmp/egg.png", rect);
    console.log("console errors:", errs.length ? errs.slice(0, 6).join(" | ") : "(none)");
    console.log("shot: /tmp/egg.png");
} catch (e) { console.error("egg-shot fatal:", e.message); }
finally { try { await ev(`window.dyo.win("close")`); } catch (e) {} await delay(600); try { app.kill("SIGKILL"); } catch (e) {} try { execSync(`pkill -9 -f \"remote-debugging-port=${PORT}"`); } catch (e) {} process.exit(okReveal ? 0 : 1); }
