// CDP smoke test for dyo-term. Launches in background (no focus steal),
// verifies boot / terminal / widgets, screenshots, and reports console errors.
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(appDir, ".smoke");
const userData = path.join(outDir, "userdata");
fs.rmSync(userData, { recursive: true, force: true });
fs.mkdirSync(userData, { recursive: true });
const PORT = 9333;
const report = { scenarios: [], consoleErrors: [], exceptions: [] };

const app = spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", `--remote-debugging-port=${PORT}`], {
    cwd: appDir,
    env: { ...process.env, DYOTERM_USER_DATA: userData, DYOTERM_BACKGROUND: "1" },
    stdio: ["ignore", "pipe", "pipe"]
});
let mainLog = "";
app.stdout.on("data", d => mainLog += d);
app.stderr.on("data", d => mainLog += d);

const delay = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0;
const pend = new Map();
const cdp = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params }));
    setTimeout(() => { if (pend.has(i)) { pend.delete(i); rej(new Error("timeout " + method)); } }, 20000);
});
const ev = async (expr, awaitPromise = false) => {
    const r = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result?.value;
};
const waitFor = async (expr, ms, label) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { try { if (await ev(expr)) return true; } catch (e) {} await delay(400); }
    throw new Error("timeout waiting: " + (label || expr));
};
async function scenario(name, fn) {
    const e = { name, ok: false, error: null };
    try { e.detail = await fn(); e.ok = true; console.log("PASS", name); }
    catch (err) { e.error = String(err.message || err).slice(0, 300); console.log("FAIL", name, "::", e.error); }
    report.scenarios.push(e);
}

try {
    fs.mkdirSync(outDir, { recursive: true });
    let target = null;
    for (let i = 0; i < 50 && !target; i++) {
        try {
            const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
            target = list.find(t => t.type === "page" && (t.url || "").includes("index.html"));
        } catch (e) {}
        await delay(1000);
    }
    if (!target) throw new Error("no page target");
    ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    ws.on("message", raw => {
        const m = JSON.parse(raw);
        if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
        else if (m.method === "Runtime.exceptionThrown") report.exceptions.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
        else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") report.consoleErrors.push(m.params.args.map(a => a.value ?? a.description ?? "").join(" ").slice(0, 300));
    });
    await cdp("Runtime.enable");
    await cdp("Page.enable");

    await scenario("boot", async () => {
        await waitFor("!!(window.term && window.dash && window.ThemeEngine && window.ThemeEngine.current)", 30000, "app boot");
        return await ev("({theme: window.ThemeEngine.current, tabs: window.term.tabs.length})");
    });
    await scenario("terminal-io", async () => {
        await waitFor("window.term.activeTab() && window.term.activeTab().focused && window.term.activeTab().focused.id", 15000, "pty ready");
        await delay(1200); // let the login shell print its first prompt
        const marker = "dyo_smoke_" + Date.now();
        await ev(`window.dyo.pty.input(window.term.activeTab().focused.id, "echo ${marker}\\n")`);
        await waitFor(`(()=>{const p=window.term.activeTab().focused; const b=p.term.buffer.active; let s=''; for(let i=0;i<b.length;i++){const l=b.getLine(i); if(l) s+=l.translateToString(true)+'\\n';} return s.split('${marker}').length>=3;})()`, 15000, "echo output");
        return "shell echoed";
    });
    await scenario("split-pane", async () => {
        await ev(`window.term.splitFocused("vertical")`);
        await delay(600);
        const n = await ev("window.term.activeTab().panes().length");
        if (n !== 2) throw new Error("expected 2 panes, got " + n);
        return "split ok (2 panes)";
    });
    await scenario("new-tab", async () => {
        await ev("window.term.newTab()");
        await delay(400);
        const n = await ev("window.term.tabs.length");
        if (n < 2) throw new Error("tabs=" + n);
        return n + " tabs";
    });
    await scenario("widgets", async () => {
        await waitFor("document.querySelectorAll('.grid-stack .widget').length >= 3", 10000, "widgets mounted");
        const titles = await ev("Array.from(document.querySelectorAll('.grid-stack .widget > header .title')).map(e=>e.textContent)");
        return "default (minimal): " + titles.join(", ");
    });
    await scenario("exec-bridge", async () => {
        const r = await ev(`window.dyo.exec("echo", ["dyo-exec-ok"])`, true);
        if (!r || r.code !== 0 || !String(r.stdout).includes("dyo-exec-ok")) throw new Error("exec failed: " + JSON.stringify(r));
        return "exec bridge works";
    });
    await scenario("catalog-add", async () => {
        const before = await ev("document.querySelectorAll('.grid-stack .widget').length");
        await ev("window.dash.openCatalog()");
        const cats = await ev("document.querySelectorAll('#catalog-body .cat-item').length");
        if (cats < 8) throw new Error("catalog too small: " + cats);
        await ev(`window.dash.addWidget("git", { autoPosition: true }, true)`);
        await ev(`window.dash.addWidget("db", { autoPosition: true }, true)`);
        await delay(400);
        const after = await ev("document.querySelectorAll('.grid-stack .widget').length");
        if (after !== before + 2) throw new Error(`expected +2 widgets, ${before}->${after}`);
        const dbForm = await ev("!!document.querySelector('.db-connect')");
        if (!dbForm) throw new Error("db widget did not render connect form");
        return `${cats} catalog items; added git + db (DataGrip-mini)`;
    });
    await scenario("sysmon-live", async () => {
        await waitFor("document.querySelector('#_sm_cpu') && document.querySelector('#_sm_cpu').textContent !== '--'", 12000, "cpu metric");
        return "cpu=" + await ev("document.querySelector('#_sm_cpu').textContent");
    });
    await scenario("theme-switch", async () => {
        await ev(`window.ThemeEngine.apply("nebula")`);
        const accent = await ev(`getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()`);
        if (!accent) throw new Error("no accent after theme switch");
        return "nebula accent " + accent;
    });
    await scenario("edit-mode", async () => {
        await ev("window.dash.setEditing(true)");
        const editing = await ev("document.body.classList.contains('editing')");
        await ev("window.dash.setEditing(false)");
        if (!editing) throw new Error("edit mode did not toggle");
        return "edit mode toggles";
    });
    await scenario("i18n", async () => {
        const enDefault = await ev("window.I18N.lang");
        if (enDefault !== "en") throw new Error("default lang not en: " + enDefault);
        await ev(`window.I18N.set("ru")`);
        const title = await ev(`document.querySelector('.grid-stack .widget[data-i18n], .grid-stack .widget header .title[data-i18n]') ? document.querySelector('.grid-stack .widget header .title[data-i18n]').textContent : ''`);
        const cpuLabel = await ev(`(document.querySelector('[data-i18n="sysmon.cpu"]')||{}).textContent`);
        await ev(`window.I18N.set("en")`);
        if (cpuLabel !== "ЦП") throw new Error("ru translation not applied: " + cpuLabel);
        return `default en, switched ru→'${title}'/'${cpuLabel}' and back`;
    });

    try {
        const shot = await cdp("Page.captureScreenshot", { format: "png" });
        fs.writeFileSync(path.join(outDir, "screenshot.png"), Buffer.from(shot.data, "base64"));
    } catch (e) {}

    report.ok = report.scenarios.every(s => s.ok) && report.exceptions.length === 0;
} catch (e) {
    report.fatal = String(e.stack || e);
    report.ok = false;
} finally {
    try { await ev(`window.dyo.win("close")`); } catch (e) {}
    await delay(1200);
    try { app.kill("SIGKILL"); } catch (e) {} try { execSync(`pkill -9 -f \"remote-debugging-port=${PORT}"`); } catch (e) {}
    report.mainLog = mainLog.split("\n").slice(-40).join("\n");
    fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
    console.log(report.ok ? "ALL PASS" : "FAILURES");
    process.exit(report.ok ? 0 : 1);
}
