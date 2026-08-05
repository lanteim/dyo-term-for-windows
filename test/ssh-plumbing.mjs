// Plumbing checks for the SSH monitor path (no real remote host is contacted;
// the ssh test targets an invalid host to confirm graceful failure).
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userData = path.join(appDir, ".smoke", "sshp-ud");
fs.rmSync(userData, { recursive: true, force: true }); fs.mkdirSync(userData, { recursive: true });
const PORT = 9373;
const app = spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", `--remote-debugging-port=${PORT}`], {
    cwd: appDir, env: { ...process.env, DYOTERM_USER_DATA: userData, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" }, stdio: ["ignore", "ignore", "ignore"]
});
const delay = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map();
const cdp = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); setTimeout(() => pend.has(i) && (pend.delete(i), rej(new Error("timeout " + m))), 25000); });
const ev = (e) => cdp("Runtime.evaluate", { expression: `(async()=>{${e}})()`, returnByValue: true, awaitPromise: true }).then(r => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; });
const checks = []; const A = (n, c, d = "") => checks.push({ n, ok: !!c, d });
try {
    let target = null;
    for (let i = 0; i < 50 && !target; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = l.find(t => t.type === "page" && (t.url || "").includes("index.html")); } catch (e) {} await delay(800); }
    ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    ws.on("message", raw => { const m = JSON.parse(raw); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
    await cdp("Runtime.enable");
    for (let i = 0; i < 40; i++) { if (await ev("return !!(window.term && window.dyo.sshTarget && window.dyo.ssh)")) break; await delay(500); }
    await delay(500);

    // 1. no ssh in the pane → sshTarget null, __monitorHost null
    const paneId = await ev("return window.term.activeTab().focused.id");
    A("has a pane id", !!paneId, String(paneId));
    const tgt = await ev(`return await window.dyo.sshTarget(${JSON.stringify(paneId)})`);
    A("sshTarget null for local shell", tgt === null, JSON.stringify(tgt));
    A("__monitorHost null when no ssh", await ev("return window.__monitorHost === null"));
    A("ctx would be local (exec routes local)", await ev("return !window.__monitorHost"));

    // 2. ssh:exec to a reserved TEST-NET IP (RFC 5737, never routable → contacts no
    //    real host) fails gracefully within the timeout (no hang).
    const t0 = Date.now();
    const r = await ev(`return await window.dyo.ssh(["-o","ConnectTimeout=4","192.0.2.1"], "echo hi", { timeout: 9000 })`);
    const dt = Date.now() - t0;
    A("ssh unreachable returns non-zero", r && r.code !== 0, JSON.stringify(r && { code: r.code }));
    A("ssh failed within timeout (no hang)", dt < 12000, dt + "ms");

    // 3. media bridge present + scan on a non-dir degrades
    A("media bridge present", await ev("return !!(window.dyo.media && window.dyo.media.scan && window.dyo.media.pickDir)"));
    const sc = await ev(`return await window.dyo.media.scan("/definitely/not/a/dir/xyz")`);
    A("media.scan bad dir → error", sc && !!sc.error, JSON.stringify(sc));

    // 4. localplayer + quote widgets mount without exception
    await ev("[...window.dash.mounted.keys()].forEach(it=>window.dash.removeItem(it)); window.dash.addWidget('localplayer',{autoPosition:true},false); window.dash.addWidget('extra_quote',{autoPosition:true},false); return true");
    await delay(700);
    A("localplayer mounted (pick state)", await ev("return !!document.querySelector('.lp') && document.querySelector('.lp-empty').innerText.length > 0"));
    A("quote shows text", await ev("return document.querySelector('._q') && document.querySelector('._q').innerText.length > 3"));
    // switch to ru → quote content should become Cyrillic
    await ev("window.I18N.set('ru'); return true"); await delay(400);
    A("quote localized to RU on switch", await ev("return /[А-Яа-я]/.test(document.querySelector('._q').innerText)"), (await ev("return document.querySelector('._q').innerText")).slice(0, 40));

    console.log("");
    let ok = true; for (const c of checks) { console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.n}${c.d ? "  (" + c.d + ")" : ""}`); if (!c.ok) ok = false; }
    console.log(ok ? "\nSSH PLUMBING + PLAYER + QUOTE OK" : "\nFAILED");
} catch (e) { console.error("ssh-plumbing fatal:", e.message); }
finally { try { await ev(`window.dyo.win("close")`); } catch (e) {} await delay(600); try { app.kill("SIGKILL"); } catch (e) {} try { execSync(`pkill -9 -f \"remote-debugging-port=${PORT}"`); } catch (e) {} process.exit(0); }
