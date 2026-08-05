// Generate a clean README screenshot: Stark theme, terminal with content,
// DOM renderer (so xterm is captured), off-screen so it never appears.
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userData = path.join(appDir, ".smoke", "shot-ud");
fs.rmSync(userData, { recursive: true, force: true });
fs.mkdirSync(userData, { recursive: true });
const PORT = 9355;

const app = spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", `--remote-debugging-port=${PORT}`], {
    cwd: appDir,
    env: { ...process.env, DYOTERM_USER_DATA: userData, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" },
    stdio: ["ignore", "ignore", "ignore"]
});
const delay = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map();
const cdp = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); setTimeout(() => pend.has(i) && (pend.delete(i), rej(new Error("t"))), 15000); });
const ev = (e, a = false) => cdp("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: a }).then(r => r.result?.value);

try {
    let target = null;
    for (let i = 0; i < 45 && !target; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = l.find(t => t.type === "page" && (t.url || "").includes("index.html")); } catch (e) {} await delay(800); }
    ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    ws.on("message", raw => { const m = JSON.parse(raw); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
    await cdp("Runtime.enable");
    await ev("!!window.term", false);
    await delay(2500);
    await ev(`window.ThemeEngine.apply("stark")`);
    // Type some representative content into the terminal
    await ev(`window.term.activeTab().focused.term.paste("cd ~ && printf '\\\\033[1;33mdyo-term\\\\033[0m ready — arm64 native\\\\n' && ls -1 | head -8\\r")`);
    await delay(1400);
    let shot = await cdp("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(appDir, "docs", "screenshot.png"), Buffer.from(shot.data, "base64"));
    console.log("wrote docs/screenshot.png");

    // Populated DevOps dashboard
    await ev(`["git","macros","netmon","db","pomodoro"].forEach(id => window.dash.addWidget(id, {autoPosition:true}, false))`);
    await delay(1800);
    shot = await cdp("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(appDir, "docs", "devops.png"), Buffer.from(shot.data, "base64"));
    console.log("wrote docs/devops.png");

    // Catalog overlay
    await ev(`window.dash.openCatalog()`);
    await delay(500);
    shot = await cdp("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(appDir, "docs", "catalog.png"), Buffer.from(shot.data, "base64"));
    console.log("wrote docs/catalog.png");
} catch (e) {
    console.error("shot error:", e.message);
} finally {
    try { await ev(`window.dyo.win("close")`); } catch (e) {}
    await delay(800); try { app.kill("SIGKILL"); } catch (e) {} try { execSync(`pkill -9 -f \"remote-debugging-port=${PORT}"`); } catch (e) {}
    process.exit(0);
}
