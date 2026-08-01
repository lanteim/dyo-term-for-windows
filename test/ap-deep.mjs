// Deep runtime test of the A.Petrov widgets: (A) local data actually populates
// over several ticks, (B) an ssh session is detected and the remote path engages.
// No real host is contacted (remote sim targets RFC5737 192.0.2.1).
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userData = path.join(appDir, ".smoke", "apdeep-ud");
fs.rmSync(userData, { recursive: true, force: true }); fs.mkdirSync(userData, { recursive: true });
const PORT = 9374;
const app = spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", `--remote-debugging-port=${PORT}`], {
    cwd: appDir, env: { ...process.env, DYOTERM_USER_DATA: userData, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" }, stdio: ["ignore", "ignore", "ignore"]
});
const delay = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(); const errs = [];
const cdp = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); setTimeout(() => pend.has(i) && (pend.delete(i), rej(new Error("timeout " + m))), 30000); });
const ev = (e) => cdp("Runtime.evaluate", { expression: `(async()=>{${e}})()`, returnByValue: true, awaitPromise: true }).then(r => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; });
const WIDGETS = [
    { id: "ap-cpu", ref: "tot", ph: "--", needData: true },
    { id: "ap-mem", ref: "pct", ph: "--", needData: true },
    { id: "ap-disk", ref: "tot", ph: "--", needData: true },
    { id: "ap-net", ref: "rx", ph: "--", needData: true },
    { id: "ap-system", ref: "uptime", ph: "--", needData: true },
    { id: "ap-services", ref: null, ph: null, needData: false }, // mac: expect notAvailable
    { id: "ap-logs", ref: null, ph: null, needData: false },
];
try {
    let target = null;
    for (let i = 0; i < 50 && !target; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = l.find(t => t.type === "page" && (t.url || "").includes("index.html")); } catch (e) {} await delay(800); }
    ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    ws.on("message", raw => { const m = JSON.parse(raw); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } else if (m.method === "Runtime.exceptionThrown") errs.push("EXC " + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || "").slice(0, 160)); else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errs.push("ERR " + m.params.args.map(a => a.value ?? a.description ?? "").join(" ").slice(0, 160)); });
    await cdp("Runtime.enable");
    for (let i = 0; i < 40; i++) { if (await ev("return !!(window.dash && window.WIDGETS['ap-cpu'] && window.APRemote)")) break; await delay(500); }
    await delay(600);

    console.log("=== A. LOCAL DATA (each widget, ~4s of ticks) ===");
    for (const w of WIDGETS) {
        await ev(`[...window.dash.mounted.keys()].forEach(it=>window.dash.removeItem(it)); window.dash.addWidget(${JSON.stringify(w.id)},{autoPosition:true},false); return true`);
        await delay(4200);
        const info = await ev(`
            const b=document.querySelector('.grid-stack .widget .body');
            const na=b.querySelector('.apw-na');
            const st=b.querySelector('.apw-status');
            const refEl=${JSON.stringify(w.ref)} ? b.querySelector('[data-ref="${w.ref}"]') : null;
            return {
                na: na ? na.innerText.slice(0,80) : null,
                status: st ? st.innerText.slice(0,80) : "",
                refVal: refEl ? refEl.textContent : null,
                text: b.innerText.replace(/\\s+/g,' ').slice(0,120)
            };
        `);
        let verdict;
        if (w.needData) {
            const populated = info.refVal != null && info.refVal !== w.ph && info.refVal !== "" && !info.na;
            verdict = populated ? "PASS" : "FAIL";
        } else {
            verdict = info.na ? "PASS(na expected on mac)" : (info.status ? "PASS(status)" : "CHECK");
        }
        console.log(`  ${verdict.startsWith("PASS") ? "PASS" : verdict}  ${w.id}  ref=${JSON.stringify(info.refVal)} na=${info.na ? "yes" : "no"} status="${info.status}"`);
        console.log(`        text: ${info.text}`);
    }

    console.log("\n=== B. REMOTE ENGAGE (simulate ssh in the focused pane → 192.0.2.1, unroutable) ===");
    await ev(`[...window.dash.mounted.keys()].forEach(it=>window.dash.removeItem(it)); window.dash.addWidget('ap-cpu',{autoPosition:true},false); return true`);
    await delay(500);
    const paneId = await ev("return window.term.activeTab().focused.id");
    // type a real ssh command into the pane; it will hang connecting (unroutable) but the process exists
    await ev(`window.dyo.pty.input(${JSON.stringify(paneId)}, "ssh -o ConnectTimeout=25 deploy@192.0.2.1\\n"); return true`);
    let host = null;
    for (let i = 0; i < 12; i++) { await delay(1000); host = await ev("return window.__monitorHost"); if (host) break; }
    console.log("  detected __monitorHost:", JSON.stringify(host));
    console.log(host && host.dest === "deploy@192.0.2.1" ? "  PASS  ssh session detected + parsed" : "  FAIL  ssh session NOT detected");
    // let the widget attempt its own ssh (BatchMode, 8s) and report
    await delay(10000);
    const rem = await ev(`
        const b=document.querySelector('.grid-stack .widget .body');
        return { host: b.querySelector('.apw-host') ? b.querySelector('.apw-host').innerText : "", status: b.querySelector('.apw-status') ? b.querySelector('.apw-status').innerText.slice(0,90) : "", tot: b.querySelector('[data-ref="tot"]') ? b.querySelector('[data-ref="tot"]').textContent : null };
    `);
    console.log("  remote widget:", JSON.stringify(rem));
    console.log(rem.host.includes("192.0.2.1") ? "  PASS  widget shows host badge (remote path engaged)" : "  FAIL  host badge missing");
    // stop the hanging ssh
    await ev(`window.dyo.pty.input(${JSON.stringify(paneId)}, "\\u0003"); return true`);

    console.log("\n=== console errors during test ===");
    console.log(errs.length ? errs.slice(0, 20).map(e => "  " + e).join("\n") : "  (none)");
} catch (e) { console.error("ap-deep fatal:", e.message); }
finally { try { await ev(`window.dyo.win("close")`); } catch (e) {} await delay(700); try { app.kill("SIGKILL"); } catch (e) {} process.exit(0); }
