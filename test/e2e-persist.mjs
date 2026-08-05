// PERSISTENCE / LIFECYCLE e2e sweep — dyo-term.
//
// Everything persistable lives in ONE file: <userData>/settings.json, written
// atomically (tmp + rename) by saveSettings() in src/main/index.js. Boot reads
// it via loadSettings() = Object.assign(DEFAULT_SETTINGS, readJSON(file, {})),
// so a corrupt/unparseable file silently falls back to defaults (readJSON
// swallows JSON.parse errors) — no separate layout file, no tab persistence.
//
// Persisted keys we exercise here (see src/renderer/core/{app,dashboard}.js):
//   theme        -> ThemeEngine.apply(key) + settings.set({theme:key})
//   lang         -> I18N.set(code)         + settings.set({lang:code})
//   density      -> dash.setDensity(name)  (persists internally)
//   dashDock     -> window.__setDock(pos)  (persists internally, also mirrors
//                   into the active layout's `dock` field via a MutationObserver)
//   layouts /
//   activeLayout -> dash.newLayout/addWidget/grid "change" -> dash.persist()
//                   (canonical 12-column coordinate space)
// Tabs are NOT persisted anywhere (TerminalManager takes no saved tab state) —
// cycle 2 asserts that policy explicitly (always exactly 1 tab after restart).
//
// CYCLE 1: fresh boot, set theme/lang/density/dock, build a dedicated widget
//          layout with 3 widgets at explicit positions, API-resize one to a
//          distinctive size, open 3 tabs, quit cleanly.
// CYCLE 2: relaunch same userData, assert every persisted item restored
//          exactly, and that tabs did NOT restore (by design).
// CYCLE 3: corrupt settings.json (truncate to half) while closed, relaunch,
//          assert no crash / no blank screen / defaults fallback.
// CYCLE 4: 5 quick consecutive settings writes (last one fire-and-forget)
//          immediately followed by an un-awaited quit — torn-write hunt.
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(appDir, ".smoke");
const userData = path.join(appDir, ".smoke", "e2e-persist-ud");
const settingsFile = path.join(userData, "settings.json");
const PORT = 9413;
const reap = () => { try { execSync(`pkill -9 -f \"remote-debugging-port=${PORT}"`); } catch (e) {} };
const delay = ms => new Promise(r => setTimeout(r, ms));

const report = { scenarios: [], consoleErrors: [], exceptions: [] };
let pass = true;
function check(name, cond, extra) {
    const e = { name, ok: !!cond, detail: extra };
    report.scenarios.push(e);
    console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  (" + JSON.stringify(extra).slice(0, 300) + ")" : ""));
    if (!cond) pass = false;
    return !!cond;
}

// ---------------------------------------------------------------- app driver ---
function launch(label) {
    const app = spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", `--remote-debugging-port=${PORT}`], {
        cwd: appDir,
        env: { ...process.env, DYOTERM_USER_DATA: userData, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" },
        stdio: ["ignore", "pipe", "pipe"]
    });
    let mainLog = "";
    app.stdout.on("data", d => mainLog += d);
    app.stderr.on("data", d => mainLog += d);
    const exited = new Promise(res => app.on("exit", (code, signal) => res({ code, signal })));

    let ws, id = 0;
    const pend = new Map();
    const cdp = (method, params = {}) => new Promise((res, rej) => {
        const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params }));
        setTimeout(() => { if (pend.has(i)) { pend.delete(i); rej(new Error("timeout " + method)); } }, 20000);
    });
    const ev = async (body, awaitPromise = true) => {
        const r = await cdp("Runtime.evaluate", { expression: `(async()=>{${body}})()`, returnByValue: true, awaitPromise });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
        return r.result?.value;
    };
    const waitFor = async (expr, ms, labelMsg) => {
        const t0 = Date.now();
        let lastErr;
        while (Date.now() - t0 < ms) {
            try { if (await ev(`return (${expr});`)) return true; } catch (e) { lastErr = e; }
            await delay(300);
        }
        throw new Error("timeout waiting: " + (labelMsg || expr) + (lastErr ? " (last err: " + lastErr.message + ")" : ""));
    };

    return {
        app, exited, ev, waitFor,
        getMainLog: () => mainLog,
        async connect() {
            let target = null;
            for (let i = 0; i < 50 && !target; i++) {
                try {
                    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
                    target = list.find(t => t.type === "page" && (t.url || "").includes("index.html"));
                } catch (e) { /* not up yet */ }
                await delay(500);
            }
            if (!target) throw new Error(label + ": no page target");
            ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
            await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
            ws.on("message", raw => {
                const m = JSON.parse(raw);
                if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
                else if (m.method === "Runtime.exceptionThrown") report.exceptions.push(`[${label}] ` + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || "").slice(0, 300));
                else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") report.consoleErrors.push(`[${label}] ` + m.params.args.map(a => a.value ?? a.description ?? "").join(" ").slice(0, 300));
            });
            await cdp("Runtime.enable");
            await cdp("Page.enable");
        },
        async screenshot(name) {
            try {
                const shot = await cdp("Page.captureScreenshot", { format: "png" });
                fs.writeFileSync(path.join(outDir, name), Buffer.from(shot.data, "base64"));
            } catch (e) { /* best effort */ }
        },
        // Quit via the normal window-close IPC path and wait for a clean exit
        // (mirrors test/quit-clean.mjs). awaitClose=false fires the IPC call
        // without waiting on its reply — used by cycle 4 to hunt torn writes.
        async quit(awaitClose = true) {
            try {
                if (awaitClose) await ev(`await window.dyo.win("close"); return true;`);
                else ev(`window.dyo.win("close"); return true;`, false).catch(() => {});
            } catch (e) { /* app may already be tearing down */ }
            const result = await Promise.race([exited, delay(15000).then(() => null)]);
            if (!result) { try { app.kill("SIGKILL"); } catch (e) {} reap(); await exited; return { code: null, signal: "TIMEOUT" }; }
            return result;
        },
        killNow() { try { app.kill("SIGKILL"); } catch (e) {} reap(); }
    };
}

// ------------------------------------------------------------------ cycle 1 ---
let d1; // will hold the final widget geometry snapshot from cycle 1, compared in cycle 2
try {
    fs.mkdirSync(outDir, { recursive: true });
    // Wipe ONLY here, at the very start — every later cycle reuses this dir.
    fs.rmSync(userData, { recursive: true, force: true });
    fs.mkdirSync(userData, { recursive: true });

    let h = launch("c1");
    await h.connect();

    await (async () => {
        try {
            await h.waitFor("window.term && window.dash && window.ThemeEngine && window.ThemeEngine.current && window.I18N", 30000, "cycle1 boot");
            check("cycle1-boot", true, await h.ev("return {theme: window.ThemeEngine.current, lang: window.I18N.lang, density: window.dash.density};"));
        } catch (e) { check("cycle1-boot", false, e.message); throw e; }
    })();

    await (async () => {
        try {
            await h.ev(`
                window.ThemeEngine.apply("nebula");
                await window.dyo.settings.set({ theme: "nebula" });
                window.I18N.set("ru");
                await window.dyo.settings.set({ lang: "ru" });
                window.dash.setDensity("compact");
                window.__setDock("left");
                await new Promise(r => setTimeout(r, 200)); // let the internal settings.set calls land
                return true;
            `);
            await delay(300);
            const r = await h.ev(`return {
                theme: window.ThemeEngine.current,
                accent: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
                lang: window.I18N.lang,
                density: window.dash.density,
                densityClass: document.body.classList.contains("density-compact"),
                dockClass: [...document.body.classList].find(c => c.startsWith("dock-"))
            };`);
            check("cycle1-set-theme-lang-density-dock", r.theme === "nebula" && r.lang === "ru" && r.density === "compact" && r.densityClass && r.dockClass === "dock-left", r);
        } catch (e) { check("cycle1-set-theme-lang-density-dock", false, e.message); }
    })();

    await (async () => {
        try {
            const layoutName = await h.ev(`return window.dash.newLayout("persist-test");`);
            await h.ev(`
                window.dash.addWidget("clock", { x: 0, y: 0, w: 4, h: 2 }, true);
                window.dash.addWidget("sysmon", { x: 4, y: 0, w: 4, h: 4 }, true);
                window.dash.addWidget("git", { x: 0, y: 4, w: 4, h: 3 }, true);
                await new Promise(r => setTimeout(r, 400));
                return true;
            `);
            const nodes = await h.ev(`return window.dash.grid.engine.nodes.map(n => ({ id: n.dyoWidget, x: n.x, y: n.y, w: n.w, h: n.h }));`);
            const wanted = ["clock", "sysmon", "git"].sort();
            const got = nodes.map(n => n.id).sort();
            check("cycle1-add-widgets", layoutName === "persist-test" && nodes.length === 3 && JSON.stringify(got) === JSON.stringify(wanted), { layoutName, nodes });
        } catch (e) { check("cycle1-add-widgets", false, e.message); }
    })();

    await (async () => {
        try {
            // API-resize the "git" widget to a distinctive size (w 4->8, h 3->6),
            // then let the grid "change" handler auto-persist it.
            await h.ev(`
                const item = [...window.dash.mounted.entries()].find(([el, rec]) => rec.widgetId === "git")[0];
                window.dash.grid.update(item, { w: 8, h: 6 });
                await new Promise(r => setTimeout(r, 400));
                return true;
            `);
            const nodes = await h.ev(`return window.dash.grid.engine.nodes.map(n => ({ id: n.dyoWidget, x: n.x, y: n.y, w: n.w, h: n.h }));`);
            const git = nodes.find(n => n.id === "git");
            check("cycle1-resize-widget", !!git && git.w === 8 && git.h === 6, { nodes });
            d1 = nodes; // snapshot compared against cycle 2's restored geometry
        } catch (e) { check("cycle1-resize-widget", false, e.message); }
    })();

    await (async () => {
        try {
            await h.ev(`window.term.newTab(); window.term.newTab(); return true;`);
            await delay(400);
            const n = await h.ev(`return window.term.tabs.length;`);
            check("cycle1-open-tabs", n === 3, { tabs: n });
        } catch (e) { check("cycle1-open-tabs", false, e.message); }
    })();

    await h.screenshot("persist-cycle1.png");

    const r1 = await h.quit(true);
    check("cycle1-quit-clean", r1.code === 0 && !r1.signal, r1);
} catch (e) {
    check("cycle1-fatal", false, String(e.stack || e));
}

// ------------------------------------------------------------------ cycle 2 ---
if (d1) {
    try {
        const h = launch("c2");
        await h.connect();
        await h.waitFor("window.term && window.dash && window.ThemeEngine && window.ThemeEngine.current && window.I18N", 30000, "cycle2 boot");
        check("cycle2-boot", true);

        const r = await h.ev(`return {
            theme: window.ThemeEngine.current,
            accent: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
            nebulaAccent: window.ThemeEngine.themes.nebula ? window.ThemeEngine.themes.nebula.colors.accent : null,
            lang: window.I18N.lang,
            density: window.dash.density,
            densityClass: document.body.classList.contains("density-compact"),
            dockClass: [...document.body.classList].find(c => c.startsWith("dock-")),
            activeLayout: window.dash.activeLayout,
            tabs: window.term.tabs.length,
            nodes: window.dash.grid.engine.nodes.map(n => ({ id: n.dyoWidget, x: n.x, y: n.y, w: n.w, h: n.h }))
        };`);

        check("cycle2-theme-restored", r.theme === "nebula" && r.accent && r.accent === r.nebulaAccent, r);
        check("cycle2-lang-restored", r.lang === "ru", r);
        check("cycle2-density-restored", r.density === "compact" && r.densityClass, r);
        check("cycle2-dock-restored", r.dockClass === "dock-left", r);
        check("cycle2-active-layout-restored", r.activeLayout === "persist-test", r);

        const sortById = arr => [...arr].sort((a, b) => a.id.localeCompare(b.id));
        const got = sortById(r.nodes), want = sortById(d1);
        check("cycle2-widgets-restored", JSON.stringify(got) === JSON.stringify(want), { got, want });

        // Tabs are NOT part of persisted state anywhere in main/index.js or
        // TerminalManager — a fresh boot always starts with exactly 1 tab,
        // regardless of how many were open at quit time.
        check("cycle2-tabs-not-restored (by design)", r.tabs === 1, r);

        await h.screenshot("persist-cycle2.png");
        const r2 = await h.quit(true);
        check("cycle2-quit-clean", r2.code === 0 && !r2.signal, r2);
    } catch (e) {
        check("cycle2-fatal", false, String(e.stack || e));
    }
} else {
    check("cycle2-skipped", false, "cycle 1 did not produce a geometry snapshot");
}

// ------------------------------------------------------------------ cycle 3 ---
try {
    const before = fs.readFileSync(settingsFile, "utf-8");
    check("cycle3-settings-file-exists-before-corrupt", before.length > 0, { bytes: before.length });
    const truncated = before.slice(0, Math.floor(before.length / 2));
    fs.writeFileSync(settingsFile, truncated);
    // sanity: this really is invalid JSON now
    let stillValid = true;
    try { JSON.parse(truncated); } catch (e) { stillValid = false; }
    check("cycle3-corrupted-file-is-invalid-json", !stillValid, { truncatedBytes: truncated.length });

    const h = launch("c3");
    await h.connect();
    let bootOk = false, bootDetail = null;
    try {
        await h.waitFor("window.term && window.dash && window.ThemeEngine && window.ThemeEngine.current && window.I18N", 10000, "cycle3 boot (10s watchdog)");
        bootOk = true;
        bootDetail = await h.ev(`return {
            hasGrid: !!document.querySelector(".grid-stack"),
            bodyChildren: document.body.children.length,
            theme: window.ThemeEngine.current,
            lang: window.I18N.lang,
            density: window.dash.density,
            dockClass: [...document.body.classList].find(c => c.startsWith("dock-")),
            widgetCount: document.querySelectorAll(".grid-stack .widget").length
        };`);
    } catch (e) {
        bootDetail = e.message;
    }
    check("cycle3-no-crash-boots-within-10s", bootOk, bootDetail);
    if (bootOk) {
        check("cycle3-no-blank-screen", bootDetail.hasGrid && bootDetail.bodyChildren > 0 && bootDetail.widgetCount > 0, bootDetail);
        check("cycle3-falls-back-to-defaults", bootDetail.theme === "stark" && bootDetail.lang === "en" && bootDetail.density === "comfortable" && bootDetail.dockClass === "dock-right", bootDetail);
    } else {
        check("cycle3-no-blank-screen", false, "boot failed, cannot inspect DOM");
        check("cycle3-falls-back-to-defaults", false, "boot failed, cannot inspect settings");
    }
    await h.screenshot("persist-cycle3.png");

    if (bootOk) {
        const r3 = await h.quit(true);
        check("cycle3-quit-clean", r3.code === 0 && !r3.signal, r3);
    } else {
        h.killNow();
        check("cycle3-quit-clean", false, "skipped: never booted");
    }
} catch (e) {
    check("cycle3-fatal", false, String(e.stack || e));
}

// ------------------------------------------------------------------ cycle 4 ---
try {
    const h = launch("c4");
    await h.connect();
    await h.waitFor("window.term && window.dash && window.ThemeEngine && window.ThemeEngine.current && window.I18N", 30000, "cycle4 boot");
    check("cycle4-boot", true);

    // 4 awaited writes, then a 5th settings.set fired WITHOUT awaiting its
    // reply, immediately followed by an un-awaited window-close IPC call —
    // torn-write / lost-write hunt around quit timing.
    await h.ev(`
        for (let i = 1; i <= 4; i++) { await window.dyo.settings.set({ _tornTest: i, theme: (i % 2 ? "nebula" : "voltage") }); }
        window.dyo.settings.set({ _tornTest: 5, theme: "mono" });
        window.dyo.win("close");
        return true;
    `);
    const r4 = await Promise.race([h.exited, delay(15000).then(() => null)]);
    let exitResult = r4;
    if (!r4) { h.killNow(); exitResult = await h.exited; check("cycle4-quit-after-race", false, "hang on quit (15s)"); }
    else check("cycle4-quit-after-race", exitResult.code === 0 && !exitResult.signal, exitResult);

    await delay(300); // let the OS flush the rename in case the process just exited
    let parsed = null, parseErr = null;
    try { parsed = JSON.parse(fs.readFileSync(settingsFile, "utf-8")); } catch (e) { parseErr = e.message; }
    check("cycle4-settings-file-valid-json", !!parsed, parseErr || { _tornTest: parsed?._tornTest, theme: parsed?.theme });
    if (parsed) {
        check("cycle4-last-change-won", parsed._tornTest === 5 && parsed.theme === "mono", { _tornTest: parsed._tornTest, theme: parsed.theme });
    } else {
        check("cycle4-last-change-won", false, "settings.json unparsable, cannot check last write");
    }
} catch (e) {
    check("cycle4-fatal", false, String(e.stack || e));
}

// ------------------------------------------------------------------- report ---
report.ok = pass && report.exceptions.length === 0;
fs.writeFileSync(path.join(outDir, "persist-report.json"), JSON.stringify(report, null, 2));
if (report.exceptions.length) console.log("\nuncaught exceptions:\n" + report.exceptions.join("\n"));
if (report.consoleErrors.length) console.log("\nconsole errors:\n" + report.consoleErrors.join("\n"));
console.log(report.ok ? "\nALL PASS" : "\nFAILURES");
process.exit(report.ok ? 0 : 1);
