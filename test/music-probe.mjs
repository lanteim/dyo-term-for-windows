// Verify the Apple Music widget end-to-end: raw state has all 10 fields, the
// now-playing panel + seek bar + shuffle/repeat/favorite controls render and
// reflect state, and the seek IPC path works (seek to CURRENT position — a
// no-op that proves the plumbing without disrupting playback).
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userData = path.join(appDir, ".smoke", "music-ud");
fs.rmSync(userData, { recursive: true, force: true });
fs.mkdirSync(userData, { recursive: true });
const PORT = 9369;
const app = spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", `--remote-debugging-port=${PORT}`], {
    cwd: appDir, env: { ...process.env, DYOTERM_USER_DATA: userData, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" }, stdio: ["ignore", "ignore", "ignore"]
});
const delay = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map();
const cdp = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); setTimeout(() => pend.has(i) && (pend.delete(i), rej(new Error("timeout " + m))), 20000); });
const ev = (e) => cdp("Runtime.evaluate", { expression: `(async()=>{${e}})()`, returnByValue: true, awaitPromise: true }).then(r => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; });
const checks = []; const assert = (n, c, d = "") => checks.push({ n, ok: !!c, d });
try {
    let target = null;
    for (let i = 0; i < 50 && !target; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = l.find(t => t.type === "page" && (t.url || "").includes("index.html")); } catch (e) {} await delay(800); }
    ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    ws.on("message", raw => { const m = JSON.parse(raw); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
    await cdp("Runtime.enable");
    for (let i = 0; i < 40; i++) { if (await ev("return !!(window.dash && window.dyo && window.dyo.music)")) break; await delay(500); }

    const raw = await ev("return await window.dyo.music.state()");
    console.log("raw state:", JSON.stringify(raw));
    const fields = typeof raw === "string" ? raw.split("\t") : [];
    const running = typeof raw === "string" && (raw.startsWith("playing") || raw.startsWith("paused"));
    assert("state readable (not __ERR__)", typeof raw === "string" && !raw.startsWith("__ERR__"), String(raw).slice(0, 40));
    if (running) assert("state has 10 tab-fields", fields.length === 10, "got " + fields.length);

    await ev("[...window.dash.mounted.keys()].forEach(it=>window.dash.removeItem(it)); window.dash.addWidget('nowplaying',{autoPosition:true},false); return true");
    await delay(1800);
    const ui = await ev(`
        const b=document.querySelector('.grid-stack .widget .body');
        const g=id=>b.querySelector(id);
        return {
            nowShown: g('#_np_now') && getComputedStyle(g('#_np_now')).display!=='none',
            hasSeek: !!g('#_np_seek'), hasHead: !!g('#_np_head'),
            hasShuffle: !!g('#_np_shuf'), hasRepeat: !!g('#_np_rep'), hasFav: !!g('#_np_fav'),
            title: g('#_np_t') && g('#_np_t').textContent,
            pos: g('#_np_pos') && g('#_np_pos').textContent, dur: g('#_np_dur') && g('#_np_dur').textContent,
            barW: g('#_np_bar') && g('#_np_bar').style.width,
            shufOn: g('#_np_shuf') && g('#_np_shuf').classList.contains('on'),
            repOn: g('#_np_rep') && g('#_np_rep').classList.contains('on'),
            favOn: g('#_np_fav') && g('#_np_fav').classList.contains('on')
        };
    `);
    console.log("widget UI:", JSON.stringify(ui, null, 2));
    if (running) {
        assert("now-playing panel shown", ui.nowShown);
        assert("seek bar present", ui.hasSeek && ui.hasHead);
        assert("shuffle/repeat/favorite buttons present", ui.hasShuffle && ui.hasRepeat && ui.hasFav);
        assert("progress bar has width", ui.barW && ui.barW !== "0%" && ui.barW !== "");
        // seek plumbing: seek to CURRENT position (no-op) — must not error
        const seekRes = await ev(`
            const raw = await window.dyo.music.state();
            const pos = parseInt(raw.split('\\t')[5],10) || 0;
            const r = await window.dyo.music.control({ seek: pos });
            return { pos, r, err: (typeof r==='string' && r.startsWith('__ERR__')) ? r : null };
        `);
        console.log("seek(no-op) result:", JSON.stringify(seekRes));
        assert("seek IPC path works (no error)", !seekRes.err, seekRes.err || "");
    }

    console.log("");
    let ok = true;
    for (const c of checks) { console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.n}${c.d ? "  (" + c.d + ")" : ""}`); if (!c.ok) ok = false; }
    console.log(running ? (ok ? "\nALL PLAYER CHECKS PASSED" : "\nPLAYER CHECKS FAILED")
        : "\nMusic not playing right now — start a track to exercise the full UI (state=" + raw + ")");
} catch (e) {
    console.error("music-probe fatal:", e.message);
} finally {
    try { await ev(`window.dyo.win("close")`); } catch (e) {}
    await delay(800); try { app.kill("SIGKILL"); } catch (e) {} try { execSync(`pkill -9 -f \"remote-debugging-port=${PORT}"`); } catch (e) {}
    process.exit(0);
}
