import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ud = path.join(appDir, ".smoke", "probe-ud"); fs.rmSync(ud, { recursive: true, force: true }); fs.mkdirSync(ud, { recursive: true });
const app = spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", "--remote-debugging-port=9377"], { cwd: appDir, env: { ...process.env, DYOTERM_USER_DATA: ud, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" }, stdio: ["ignore", "ignore", "ignore"] });
const delay = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map();
const cdp = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); setTimeout(() => pend.has(i) && (pend.delete(i), rej(new Error("t"))), 15000); });
const ev = (e, a = false) => cdp("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: a }).then(r => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; });
const dump = () => ev(`(()=>{const p=window.term.activeTab().focused;const b=p.term.buffer.active;let s='';for(let i=0;i<b.length;i++){const l=b.getLine(i);if(l){const t=l.translateToString(true);if(t.trim())s+=t+'\\n';}}return {id:p.id, cwd:window.term.lastCwd, text:s};})()`);
try {
    let target = null;
    for (let i = 0; i < 40 && !target; i++) { try { const l = await (await fetch("http://127.0.0.1:9377/json/list")).json(); target = l.find(t => t.type === "page" && (t.url || "").includes("index.html")); } catch (e) {} await delay(700); }
    ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    ws.on("message", raw => { const m = JSON.parse(raw); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
    await cdp("Runtime.enable");
    for (let i = 0; i < 30; i++) { if (await ev("!!(window.term && window.term.activeTab() && window.term.activeTab().focused && window.term.activeTab().focused.id)")) break; await delay(400); }
    await delay(2500);
    console.log("BEFORE:", JSON.stringify(await dump()));
    // method 1: direct pty input
    await ev(`window.dyo.pty.input(window.term.activeTab().focused.id, "echo PROBE_DIRECT\\n")`);
    await delay(2000);
    console.log("AFTER pty.input:", JSON.stringify(await dump()));
    // method 2: term.paste
    await ev(`window.term.activeTab().focused.term.paste("echo PROBE_PASTE\\r")`);
    await delay(2000);
    console.log("AFTER term.paste:", JSON.stringify(await dump()));
} catch (e) { console.error("probe err:", e.message); }
finally { try { await ev(`window.dyo.win("close")`); } catch (e) {} await delay(800); try { app.kill("SIGKILL"); } catch (e) {} process.exit(0); }
