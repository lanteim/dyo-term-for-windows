// Regression test: clock widget must format its DISPLAY date with the app
// language (window.I18N.locale() -> "en-US"/"ru-RU"), NOT the OS locale.
// This machine's OS locale is ru_RU while the app boots with I18N.lang="en",
// so a regression (e.g. toLocaleDateString() with no locale argument) shows
// up as Cyrillic in the date line under lang=en.
// Selectors grounded in src/renderer/widgets/clock.js: #_clk_t (time), #_clk_d (date).
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(appDir, ".smoke");
const userData = path.join(outDir, "clkloc-ud");
fs.rmSync(userData, { recursive: true, force: true });
fs.mkdirSync(userData, { recursive: true });
const PORT = 9409;
const report = { scenarios: [], consoleErrors: [], exceptions: [] };

const CYRILLIC = /[Ѐ-ӿ]/;
// clock.js formats: { weekday:"long", day:"numeric", month:"short", year:"numeric" }
const EN_WEEKDAY = /(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)/;
const EN_MONTH = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/;

const app = spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", `--remote-debugging-port=${PORT}`], {
    cwd: appDir,
    env: { ...process.env, DYOTERM_USER_DATA: userData, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" },
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
// Poll until pred(dateText) holds. The clock ticks once a second, so a language
// switch shows in the DOM within ~1s; we allow up to `ms` (default 3s) of slack.
const dateText = () => ev("(document.querySelector('#_clk_d')||{}).textContent || ''");
const waitDate = async (pred, ms, label) => {
    const t0 = Date.now();
    let last = "";
    while (Date.now() - t0 < ms) {
        last = await dateText();
        if (pred(last)) return last;
        await delay(250);
    }
    throw new Error(`timeout waiting: ${label} (last date line: "${last}")`);
};
async function scenario(name, fn) {
    const e = { name, ok: false, error: null };
    try { e.detail = await fn(); e.ok = true; console.log("PASS", name, "::", e.detail); }
    catch (err) { e.error = String(err.message || err).slice(0, 300); console.log("FAIL", name, "::", e.error); }
    report.scenarios.push(e);
}

try {
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
        const t0 = Date.now();
        while (Date.now() - t0 < 30000) {
            try { if (await ev("!!(window.dash && window.I18N && window.WIDGETS && window.WIDGETS.clock)")) break; } catch (e) {}
            await delay(400);
        }
        const lang = await ev("window.I18N.lang");
        if (lang !== "en") throw new Error("app did not boot with lang=en: " + lang);
        return "booted, I18N.lang=en";
    });

    await scenario("clock-mounted", async () => {
        const had = await ev("!!document.querySelector('#_clk_d')");
        if (!had) await ev(`window.dash.addWidget("clock",{autoPosition:true},false)`);
        const d = await waitDate(t => t.trim().length > 0, 8000, "clock date rendered");
        return (had ? "clock already mounted" : "clock added via dash.addWidget") + `; date="${d}"`;
    });

    await scenario("locale-fn-en", async () => {
        const loc = await ev("window.I18N.locale()");
        if (loc !== "en-US") throw new Error("I18N.locale() for lang=en returned " + loc);
        return "I18N.locale()=en-US";
    });

    await scenario("date-english-despite-ru-os", async () => {
        // OS locale is ru_RU — the date must still be English because the app lang is en.
        const d = await waitDate(t => EN_WEEKDAY.test(t) && EN_MONTH.test(t) && !CYRILLIC.test(t), 4000, "English date under lang=en");
        return `"${d}" is English, no Cyrillic`;
    });

    await scenario("switch-ru-date-russian", async () => {
        await ev(`window.I18N.set("ru")`);
        const loc = await ev("window.I18N.locale()");
        if (loc !== "ru-RU") throw new Error("I18N.locale() for lang=ru returned " + loc);
        // clock ticks every second — the Russian date must appear within ~2s
        const d = await waitDate(t => CYRILLIC.test(t) && !EN_WEEKDAY.test(t), 3000, "Russian date after I18N.set('ru')");
        return `I18N.locale()=ru-RU; "${d}" has Cyrillic`;
    });

    await scenario("switch-back-en-date-english", async () => {
        await ev(`window.I18N.set("en")`);
        const d = await waitDate(t => EN_WEEKDAY.test(t) && EN_MONTH.test(t) && !CYRILLIC.test(t), 3000, "English date after I18N.set('en')");
        return `"${d}" back to English`;
    });

    await scenario("no-console-errors", async () => {
        if (report.consoleErrors.length) throw new Error("console errors: " + report.consoleErrors.join(" | ").slice(0, 250));
        if (report.exceptions.length) throw new Error("exceptions: " + report.exceptions.join(" | ").slice(0, 250));
        return "zero console errors / exceptions";
    });

    report.ok = report.scenarios.every(s => s.ok);
} catch (e) {
    report.fatal = String(e.stack || e);
    report.ok = false;
} finally {
    try { await ev(`window.dyo.win("close")`); } catch (e) {}
    await delay(1200);
    try { app.kill("SIGKILL"); } catch (e) {}
    try { execSync(`pkill -9 -f \"remote-debugging-port=${PORT}"`); } catch (e) {}
    report.mainLog = mainLog.split("\n").slice(-30).join("\n");
    fs.writeFileSync(path.join(outDir, "clock-locale-report.json"), JSON.stringify(report, null, 2));
    console.log(report.ok ? "ALL PASS" : "FAILURES");
    process.exit(report.ok ? 0 : 1);
}
