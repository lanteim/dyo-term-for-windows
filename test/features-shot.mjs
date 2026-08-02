// Screenshot the new v0.5.0 features: a richer A.Petrov graph (populated) and the
// command palette overlay. Fake/local data only.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userData = path.join(appDir, ".smoke", "feat-ud");
fs.rmSync(userData, { recursive: true, force: true }); fs.mkdirSync(userData, { recursive: true });
const PORT = 9378;
const app = spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", `--remote-debugging-port=${PORT}`], {
    cwd: appDir, env: { ...process.env, DYOTERM_USER_DATA: userData, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" }, stdio: ["ignore", "ignore", "ignore"]
});
const delay = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(); const errs = [];
const cdp = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); setTimeout(() => pend.has(i) && (pend.delete(i), rej(new Error("timeout " + m))), 20000); });
const ev = (e) => cdp("Runtime.evaluate", { expression: `(async()=>{${e}})()`, returnByValue: true, awaitPromise: true }).then(r => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; });
async function shot(file, clip) { const r = await cdp("Page.captureScreenshot", { format: "png", clip: clip ? { ...clip, scale: 1 } : undefined }); fs.writeFileSync(file, Buffer.from(r.data, "base64")); }
try {
    let target = null;
    for (let i = 0; i < 50 && !target; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = l.find(t => t.type === "page" && (t.url || "").includes("index.html")); } catch (e) {} await delay(800); }
    ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    ws.on("message", raw => { const m = JSON.parse(raw); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } else if (m.method === "Runtime.exceptionThrown") errs.push((m.params.exceptionDetails?.exception?.description || "").slice(0, 160)); });
    await cdp("Runtime.enable"); await cdp("Page.enable");
    await cdp("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1000, deviceScaleFactor: 2, mobile: false });
    for (let i = 0; i < 40; i++) { if (await ev("return !!(window.dash && window.WIDGETS['ap-cpu'])")) break; await delay(500); }

    // 1) a big ap-cpu so the graph fills + gets several samples (richer render: gridlines/peak/last dot)
    await ev("if(window.__setDock)window.__setDock('bottom'); [...window.dash.mounted.keys()].forEach(it=>window.dash.removeItem(it)); window.dash.addWidget('ap-cpu',{x:0,y:0,w:6,h:10},false); return true");
    await delay(9000); // ~4-5 ticks of history
    const g = await ev(`const b=document.querySelector('.grid-stack .widget'); const r=b.getBoundingClientRect(); const cv=b.querySelector('canvas'); return {rect:{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}, graphH: cv?Math.round(cv.getBoundingClientRect().height):0, points: (window.dash.mounted.size)}`);
    console.log("cpu widget:", JSON.stringify(g));
    await shot("/tmp/feat_graph.png", g.rect);

    // 2) command palette (⌘⇧P)
    await ev(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'p',code:'KeyP',metaKey:true,shiftKey:true,bubbles:true})); return true`);
    await delay(500);
    let pal = await ev(`const o=[...document.querySelectorAll('.overlay.open, .palette, #palette, [class*=palette]')].find(Boolean); return o?{cls:o.className,items:o.querySelectorAll('*').length}:null`);
    if (!pal) { // fallback: maybe a global opener
        await ev(`if(window.__openPalette)window.__openPalette(); else if(window.Palette&&window.Palette.open)window.Palette.open(); return true`);
        await delay(400);
        pal = await ev(`const o=[...document.querySelectorAll('.overlay.open, .palette, #palette, [class*=palette]')].find(Boolean); return o?{cls:o.className}:null`);
    }
    console.log("palette:", JSON.stringify(pal));
    await shot("/tmp/feat_palette.png", { x: 0, y: 0, width: 1600, height: 1000 });

    console.log("console errors:", errs.length ? errs.slice(0, 6).join(" | ") : "(none)");
    console.log("shots: /tmp/feat_graph.png /tmp/feat_palette.png");
} catch (e) { console.error("features-shot fatal:", e.message); }
finally { try { await ev(`window.dyo.win("close")`); } catch (e) {} await delay(600); try { app.kill("SIGKILL"); } catch (e) {} process.exit(0); }
