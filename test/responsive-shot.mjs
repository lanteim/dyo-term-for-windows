// Render dyo-term at several monitor sizes/aspect ratios and screenshot each,
// to evaluate + improve responsiveness (esp. ultrawide). Uses fake data only.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userData = path.join(appDir, ".smoke", "resp-ud");
fs.rmSync(userData, { recursive: true, force: true }); fs.mkdirSync(userData, { recursive: true });
const PORT = 9377;
const app = spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", `--remote-debugging-port=${PORT}`], {
    cwd: appDir, env: { ...process.env, DYOTERM_USER_DATA: userData, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" }, stdio: ["ignore", "ignore", "ignore"]
});
const delay = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map();
const cdp = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); setTimeout(() => pend.has(i) && (pend.delete(i), rej(new Error("timeout " + m))), 20000); });
const ev = (e) => cdp("Runtime.evaluate", { expression: `(async()=>{${e}})()`, returnByValue: true, awaitPromise: true }).then(r => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; });
const SIZES = [
    { name: "14in", w: 1512, h: 982, dpr: 2 },
    { name: "27in-qhd", w: 2560, h: 1440, dpr: 1 },
    { name: "34in-uw", w: 3440, h: 1440, dpr: 1 },
    { name: "49in-suw", w: 5120, h: 1440, dpr: 1 },
];
try {
    let target = null;
    for (let i = 0; i < 50 && !target; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = l.find(t => t.type === "page" && (t.url || "").includes("index.html")); } catch (e) {} await delay(800); }
    ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    ws.on("message", raw => { const m = JSON.parse(raw); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
    await cdp("Runtime.enable"); await cdp("Page.enable");
    for (let i = 0; i < 40; i++) { if (await ev("return !!(window.dash && window.WIDGETS['ap-cpu'])")) break; await delay(500); }
    // populate a realistic dashboard
    await ev(`
        [...window.dash.mounted.keys()].forEach(it=>window.dash.removeItem(it));
        const add=(id,x,y,w,h)=>window.dash.addWidget(id,{x,y,w,h},false);
        add('clock',0,0,12,2); add('ap-cpu',0,2,6,5); add('ap-mem',6,2,6,5);
        add('ap-net',0,7,6,5); add('ap-system',6,7,6,5); add('notes',0,12,6,4); add('cmdhistory',6,12,6,4);
        return true;
    `);
    await delay(1500);
    for (const s of SIZES) {
        await cdp("Emulation.setDeviceMetricsOverride", { width: s.w, height: s.h, deviceScaleFactor: s.dpr, mobile: false });
        await delay(900);
        // report layout metrics
        const m = await ev(`
            const main=document.getElementById('main').getBoundingClientRect();
            const tcol=document.getElementById('terminal-col').getBoundingClientRect();
            const dcol=document.getElementById('dash-col').getBoundingClientRect();
            const cols=window.dash.grid?window.dash.grid.getColumn():'?';
            return { win: innerWidth+'x'+innerHeight, terminalW: Math.round(tcol.width), dashW: Math.round(dcol.width), gridCols: cols };
        `);
        const r = await cdp("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: s.w, height: Math.min(s.h, 1440), scale: 1 } });
        fs.writeFileSync("/tmp/resp_" + s.name + ".png", Buffer.from(r.data, "base64"));
        console.log(s.name.padEnd(10), JSON.stringify(m));
    }
    console.log("shots: /tmp/resp_14in.png resp_27in-qhd.png resp_34in-uw.png resp_49in-suw.png");
} catch (e) { console.error("responsive-shot fatal:", e.message); }
finally { try { await ev(`window.dyo.win("close")`); } catch (e) {} await delay(600); try { app.kill("SIGKILL"); } catch (e) {} process.exit(0); }
