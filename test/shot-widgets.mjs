// Screenshot a specific set of widgets (comma-separated ids in argv[2]) laid
// out on the dashboard, for visual spot-checks. Off-screen, no focus steal.
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ids = (process.argv[2] || "nowplaying,git,htop,tool_regex,db").split(",");
const outName = process.argv[3] || "spotcheck";
const ud = path.join(appDir, ".smoke", "shot-w-ud"); fs.rmSync(ud, { recursive: true, force: true }); fs.mkdirSync(ud, { recursive: true });
const app = spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", "--remote-debugging-port=9388"], { cwd: appDir, env: { ...process.env, DYOTERM_USER_DATA: ud, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" }, stdio: ["ignore", "ignore", "ignore"] });
const delay = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map();
const cdp = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); setTimeout(() => pend.has(i) && (pend.delete(i), rej(new Error("t"))), 15000); });
const ev = (e, a = false) => cdp("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: a }).then(r => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; });
try {
    let target = null;
    for (let i = 0; i < 40 && !target; i++) { try { const l = await (await fetch("http://127.0.0.1:9388/json/list")).json(); target = l.find(t => t.type === "page" && (t.url || "").includes("index.html")); } catch (e) {} await delay(700); }
    ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    ws.on("message", raw => { const m = JSON.parse(raw); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
    await cdp("Runtime.enable");
    for (let i = 0; i < 30; i++) { if (await ev("!!(window.dash && window.WIDGETS)")) break; await delay(400); }
    await ev(`[...window.dash.mounted.keys()].forEach(it => window.dash.removeItem(it))`);
    await ev(`(${JSON.stringify(ids)}).forEach(id => { if (window.WIDGETS[id]) window.dash.addWidget(id, { autoPosition: true }, false); })`);
    await delay(2500);
    const shot = await cdp("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(appDir, ".smoke", outName + ".png"), Buffer.from(shot.data, "base64"));
    console.log("wrote .smoke/" + outName + ".png with:", ids.join(", "));
} catch (e) { console.error("shot err:", e.message); }
finally { try { await ev(`window.dyo.win("close")`); } catch (e) {} await delay(700); try { app.kill("SIGKILL"); } catch (e) {} try { execSync('pkill -9 -f \"remote-debugging-port=9388"'); } catch (e) {} process.exit(0); }
