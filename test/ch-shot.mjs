// Verify the Command History widget: (1) button logic by ROW COUNTS only (never
// reads the user's actual command text), (2) visual readability by injecting
// MY OWN fake rows into the real widget DOM/CSS and screenshotting.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userData = path.join(appDir, ".smoke", "ch-ud");
fs.rmSync(userData, { recursive: true, force: true }); fs.mkdirSync(userData, { recursive: true });
const PORT = 9376;
const app = spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", `--remote-debugging-port=${PORT}`], {
    cwd: appDir, env: { ...process.env, DYOTERM_USER_DATA: userData, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" }, stdio: ["ignore", "ignore", "ignore"]
});
const delay = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map();
const cdp = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); setTimeout(() => pend.has(i) && (pend.delete(i), rej(new Error("timeout " + m))), 20000); });
const ev = (e) => cdp("Runtime.evaluate", { expression: `(async()=>{${e}})()`, returnByValue: true, awaitPromise: true }).then(r => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; });
async function shot(file, clip) { const r = await cdp("Page.captureScreenshot", { format: "png", clip: { ...clip, scale: 1 } }); fs.writeFileSync(file, Buffer.from(r.data, "base64")); }
const checks = []; const A = (n, c, d = "") => checks.push({ n, ok: !!c, d });
try {
    let target = null;
    for (let i = 0; i < 50 && !target; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = l.find(t => t.type === "page" && (t.url || "").includes("index.html")); } catch (e) {} await delay(800); }
    ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    ws.on("message", raw => { const m = JSON.parse(raw); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
    await cdp("Runtime.enable"); await cdp("Page.enable");
    await cdp("Emulation.setDeviceMetricsOverride", { width: 1500, height: 950, deviceScaleFactor: 2, mobile: false });
    for (let i = 0; i < 40; i++) { if (await ev("return !!(window.dash && window.WIDGETS.cmdhistory)")) break; await delay(500); }
    await ev("if(window.__setDock) window.__setDock('bottom'); return true");
    await ev("[...window.dash.mounted.keys()].forEach(it=>window.dash.removeItem(it)); window.dash.addWidget('cmdhistory',{x:0,y:0,w:6,h:9},false); return true");
    await delay(1200);

    // ---- button logic: read ROW COUNTS ONLY (privacy: never read command text) ----
    const total = await ev(`const f=document.querySelector('.ch-foot').textContent.match(/(\\d+)\\s*$/); return f?+f[1]:0;`);
    A("has history rows", total > 0, "total=" + total);
    A("default shows 5", await ev(`return document.querySelectorAll('.ch-row').length`) === Math.min(5, total), "default=" + await ev(`return document.querySelectorAll('.ch-row').length`));
    A("default button '5' active", await ev(`return document.querySelector('.ch-b.on') && document.querySelector('.ch-b.on').textContent==='5'`));
    for (const n of [15, 50, 100]) {
        await ev(`[...document.querySelectorAll('.ch-b')].find(b=>b.dataset.n==='${n}').click(); return true`); await delay(150);
        const shown = await ev(`return document.querySelectorAll('.ch-row').length`);
        A(`button ${n} shows min(${n},total)`, shown === Math.min(n, total), "shown=" + shown);
    }
    await ev(`[...document.querySelectorAll('.ch-b')].find(b=>b.dataset.n==='all').click(); return true`); await delay(200);
    A("button All shows everything", await ev(`return document.querySelectorAll('.ch-row').length`) === total);

    // ---- visual readability: inject MY OWN fake rows into the real widget CSS ----
    await ev(`[...document.querySelectorAll('.ch-b')].find(b=>b.dataset.n==='5').click(); return true`); await delay(100);
    await ev(`
        const esc=s=>s.replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
        const fake=[
          'ls -la',
          'git commit -m "fix: readable command history"',
          'docker ps -a --format "{{.Names}} {{.Status}}"',
          'ssh -o StrictHostKeyChecking=no deploy@jira-conf-dev.gglx.me "systemctl restart jira && journalctl -u jira -n 300 --no-pager | grep -i error | tail -50"',
          'kubectl get pods -n production -o wide --sort-by=.status.startTime',
          'find . -type f -name "*.log" -mtime -1 -exec grep -l "timeout" {} \\\\; | head -20 | xargs wc -l'
        ];
        document.querySelector('.ch-list').innerHTML = fake.map((c,i)=>'<div class="ch-row"><span class="ch-n">'+(i+1)+'</span><span class="ch-cmd">'+esc(c)+'</span></div>').join('');
        document.querySelector('.ch-foot').textContent='showing 6 of 6 (demo)';
        return true;
    `);
    await delay(300);
    const rect = await ev(`const w=document.querySelector('.grid-stack .widget'); const r=w.getBoundingClientRect(); return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)};`);
    await shot("/tmp/ch_demo.png", rect);

    console.log("");
    let ok = true; for (const c of checks) { console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.n}${c.d ? "  (" + c.d + ")" : ""}`); if (!c.ok) ok = false; }
    console.log(ok ? "\nBUTTON LOGIC OK" : "\nLOGIC FAILED");
    console.log("demo screenshot (fake data): /tmp/ch_demo.png  rect=" + JSON.stringify(rect));
} catch (e) { console.error("ch-shot fatal:", e.message); }
finally { try { await ev(`window.dyo.win("close")`); } catch (e) {} await delay(600); try { app.kill("SIGKILL"); } catch (e) {} process.exit(0); }
