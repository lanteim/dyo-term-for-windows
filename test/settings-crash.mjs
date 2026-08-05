// Regression test: settings.json atomicity under a hard crash (kill -9 mid-save).
//
// main/index.js saveSettings() writes settings.json.tmp then renameSync -> settings.json.
// This test boots the app, fires a burst of real settings saves through the app's own
// persistence paths (settings:set IPC — the same path the theme gallery, density switch
// and language switch use), then SIGKILLs every process matching the CDP port flag
// mid-burst. After the crash, <userData>/settings.json must still parse as valid JSON
// (old OR new values both acceptable), and the app must reboot cleanly on the same
// userData. 3 rounds; any corruption or failed boot fails the run.
//
// Launch constraints (per project rules): DYOTERM_BACKGROUND=1, DYOTERM_NO_WEBGL=1,
// userData under .smoke/, dedicated CDP port 9408.
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(appDir, ".smoke");
const userData = path.join(outDir, "scrash-ud");
const PORT = 9408;
const SETTINGS = path.join(userData, "settings.json");
const ROUNDS = 3;
const report = { port: PORT, rounds: [] };
const delay = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- process reaping ---
function portPids() {
    try {
        return execSync(`pgrep -f "remote-debugging-port=${PORT}"`, { encoding: "utf-8" })
            .split("\n").map(s => parseInt(s, 10)).filter(n => Number.isFinite(n) && n !== process.pid);
    } catch (e) { return []; } // pgrep exits 1 when nothing matches
}
function hardKillAll() {
    // pgrep -f matches the node wrapper AND the real Electron processes — kill -9 them all.
    const pids = portPids();
    for (const pid of pids) { try { process.kill(pid, "SIGKILL"); } catch (e) {} }
    return pids;
}
async function reapPort(label) {
    for (let i = 0; i < 20; i++) {
        try { execSync(`pkill -9 -f "remote-debugging-port=${PORT}"`); } catch (e) {}
        if (portPids().length === 0) return;
        await delay(250);
    }
    throw new Error(`could not reap port ${PORT} processes (${label})`);
}

// ---------------------------------------------------------------- one app boot ---
async function bootApp(label) {
    const child = spawn(path.join(appDir, "node_modules", ".bin", "electron"),
        [".", `--remote-debugging-port=${PORT}`], {
            cwd: appDir,
            env: { ...process.env, DYOTERM_USER_DATA: userData, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" },
            stdio: ["ignore", "pipe", "pipe"]
        });
    let log = "";
    child.stdout.on("data", d => log += d);
    child.stderr.on("data", d => log += d);
    const exited = new Promise(res => child.on("exit", (code, sig) => res({ code, sig })));

    let target = null;
    for (let i = 0; i < 45 && !target; i++) {
        try {
            const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
            target = list.find(t => t.type === "page" && (t.url || "").includes("index.html"));
        } catch (e) {}
        if (!target) await delay(1000);
    }
    if (!target) throw new Error(`${label}: no CDP page target on ${PORT}; log tail: ` + log.slice(-500));

    const ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 16 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    let id = 0;
    const pend = new Map();
    ws.on("message", raw => {
        const m = JSON.parse(raw);
        if (m.id && pend.has(m.id)) {
            const p = pend.get(m.id); pend.delete(m.id);
            m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
        }
    });
    ws.on("error", () => {});
    ws.on("close", () => { for (const p of pend.values()) p.rej(new Error("ws closed")); pend.clear(); });
    const cdp = (method, params = {}) => new Promise((res, rej) => {
        const i = ++id; pend.set(i, { res, rej });
        try { ws.send(JSON.stringify({ id: i, method, params })); } catch (e) { pend.delete(i); rej(e); }
        setTimeout(() => { if (pend.has(i)) { pend.delete(i); rej(new Error("timeout " + method)); } }, 20000);
    });
    const ev = async (expr, awaitPromise = false) => {
        const r = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
        return r.result?.value;
    };
    const waitFor = async (expr, ms, what) => {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) { try { if (await ev(expr)) return; } catch (e) {} await delay(400); }
        throw new Error(`${label}: timeout waiting for ${what}`);
    };
    await cdp("Runtime.enable");
    return { child, ws, cdp, ev, waitFor, exited, getLog: () => log };
}

// ---------------------------------------------------------------- rounds ---
let ok = true;
try {
    fs.mkdirSync(outDir, { recursive: true });
    await reapPort("pre-run stale");

    for (let round = 1; round <= ROUNDS; round++) {
        const r = { round, steps: [] };
        report.rounds.push(r);
        const step = (name, detail) => { r.steps.push({ name, detail }); console.log(`[round ${round}] ${name}${detail ? " :: " + detail : ""}`); };

        // fresh userData once per round; the relaunch below reuses it
        fs.rmSync(userData, { recursive: true, force: true });
        fs.mkdirSync(userData, { recursive: true });

        // ---- boot #1 ----
        const a = await bootApp(`round ${round} boot1`);
        try {
            await a.waitFor("!!(window.term && window.dash && window.ThemeEngine && window.ThemeEngine.current && window.I18N)", 30000, "app ready");
            step("boot1", "app ready");

            // one confirmed save so settings.json is guaranteed to exist before the crash
            await a.ev(`window.dyo.settings.set({ theme: window.ThemeEngine.current })`, true);
            if (!fs.existsSync(SETTINGS)) throw new Error("settings.json missing after confirmed save");
            step("seed-save", "settings.json exists");

            // Burst of REAL saves through the app's own persistence paths (all funnel
            // into settings:set IPC -> saveSettings tmp+rename in main). ThemeEngine.apply
            // and I18N.set alone don't persist — the app pairs them with settings.set
            // (see app.js theme card onclick / setLang), and dash.setDensity persists
            // itself (dashboard.js _applyDensity save=true). Fire-and-forget: do NOT
            // await, so the kill lands mid-save.
            const themes = ["nebula", "stark"];
            const dens = ["compact", "spacious", "comfortable"];
            const langs = ["ru", "en"];
            let fired = 0;
            for (let i = 0; i < 25; i++) {
                const t = themes[i % themes.length], d = dens[i % dens.length], l = langs[i % langs.length];
                a.ev(`window.ThemeEngine.apply(${JSON.stringify(t)}); window.dyo.settings.set({ theme: ${JSON.stringify(t)} })`).catch(() => {});
                a.ev(`window.dash.setDensity(${JSON.stringify(d)})`).catch(() => {});
                a.ev(`window.I18N.set(${JSON.stringify(l)}); window.dyo.settings.set({ lang: ${JSON.stringify(l)}, crashProbe: ${Date.now() + i} })`).catch(() => {});
                fired += 3;
            }
            await delay(60); // let saves be mid-flight, then crash
            const killed = hardKillAll();
            step("hard-kill", `fired ${fired} save calls, SIGKILLed pids [${killed.join(", ")}]`);
            if (killed.length === 0) throw new Error("pgrep found no processes to kill");
        } finally {
            try { a.ws.close(); } catch (e) {}
        }
        await Promise.race([a.exited, delay(5000)]);
        await reapPort(`round ${round} post-kill`);

        // ---- atomicity assertion ----
        const raw = fs.readFileSync(SETTINGS, "utf-8"); // throws if missing => fail
        const parsed = JSON.parse(raw);                  // throws if corrupted => fail
        if (typeof parsed !== "object" || parsed === null) throw new Error("settings.json parsed to non-object");
        step("atomicity", `settings.json valid JSON, ${raw.length} bytes, theme=${parsed.theme}, density=${parsed.density}, lang=${parsed.lang}`);

        // ---- boot #2: same userData must come up clean ----
        const b = await bootApp(`round ${round} boot2`);
        try {
            await b.waitFor("!!(window.term && window.dash && window.ThemeEngine && window.ThemeEngine.current)", 30000, "relaunch ready (window.term)");
            const state = await b.ev("({ theme: window.ThemeEngine.current, tabs: window.term.tabs.length })");
            step("relaunch", `booted clean after crash: ${JSON.stringify(state)}`);
            try { await b.ev(`window.dyo.win("close")`); } catch (e) {}
        } finally {
            try { b.ws.close(); } catch (e) {}
        }
        const quit = await Promise.race([b.exited, delay(4000).then(() => null)]);
        if (!quit) { try { b.child.kill("SIGKILL"); } catch (e) {} }
        step("quit", quit ? `exited (code=${quit.code}, sig=${quit.sig})` : "close timed out, killed");
        await reapPort(`round ${round} post-quit`);
    }
    report.ok = true;
} catch (e) {
    ok = false;
    report.ok = false;
    report.fatal = String(e.stack || e).slice(0, 1500);
    console.error("FATAL:", String(e.message || e));
} finally {
    try { await reapPort("final"); } catch (e) { ok = false; }
    fs.writeFileSync(path.join(outDir, "settings-crash-report.json"), JSON.stringify(report, null, 2));
    console.log(report.ok ? "ALL PASS (settings atomic under hard crash, 3/3 rounds)" : "FAILURES");
    process.exit(report.ok ? 0 : 1);
}
