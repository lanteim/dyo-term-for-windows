// e2e-chaos: hostile-timing / stress sweep for dyo-term.
// Rapid tab churn, deep splits, widget add/remove leak hunt, toggle interleaving,
// wheel + synthetic-paste storms, SIGKILL of live shells, catalog thrash, then
// 3 boot->quit cycles hunting the teardown race. Synthetic input only; the window
// is created off-screen (DYOTERM_BACKGROUND=1) and never shown.
import { spawn, execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(appDir, ".smoke");
const userData = path.join(outDir, "e2e-chaos-ud");
const PORT = 9412;
const delay = ms => new Promise(r => setTimeout(r, ms));

fs.mkdirSync(outDir, { recursive: true });

let pass = true;
const results = [];
const check = (name, cond, extra) => {
    const ok = !!cond;
    if (!ok) pass = false;
    console.log((ok ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  (" + extra + ")" : ""));
    results.push({ name, ok, detail: extra === undefined ? "" : String(extra) });
};

const sh = (cmd, args) => new Promise(res =>
    execFile(cmd, args, { timeout: 10000 }, (e, so, se) => res({ code: e ? (e.code ?? 1) : 0, out: String(so || ""), err: String(se || "") })));

// ---------------------------------------------------------------- CDP glue ---
function makeClient() {
    const st = { ws: null, id: 0, pend: new Map(), consoleErrors: [], exceptions: [], phase: "boot" };
    st.cdp = (m, p = {}) => new Promise((res, rej) => {
        const i = ++st.id; st.pend.set(i, { res, rej });
        st.ws.send(JSON.stringify({ id: i, method: m, params: p }));
        setTimeout(() => { if (st.pend.has(i)) { st.pend.delete(i); rej(new Error("timeout " + m)); } }, 30000);
    });
    st.ev = (expr) => st.cdp("Runtime.evaluate", {
        expression: `(async()=>{${expr}})()`, returnByValue: true, awaitPromise: true
    }).then(r => {
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
        return r.result?.value;
    });
    st.waitFor = async (expr, ms, label) => {
        const t0 = Date.now();
        let last;
        while (Date.now() - t0 < ms) {
            try { last = await st.ev("return (" + expr + ")"); if (last) return last; } catch (e) { last = "err:" + e.message; }
            await delay(300);
        }
        throw new Error("timeout waiting " + (label || expr) + " last=" + JSON.stringify(last));
    };
    return st;
}

async function attach(st) {
    let target = null;
    for (let i = 0; i < 60 && !target; i++) {
        try {
            const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
            target = l.find(t => t.type === "page" && (t.url || "").includes("index.html"));
        } catch (e) { /* not up yet */ }
        if (!target) await delay(700);
    }
    if (!target) throw new Error("no page target on port " + PORT);
    st.ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
    await new Promise((res, rej) => { st.ws.on("open", res); st.ws.on("error", rej); });
    st.ws.on("message", raw => {
        let m; try { m = JSON.parse(raw); } catch (e) { return; }
        if (m.id && st.pend.has(m.id)) {
            const p = st.pend.get(m.id); st.pend.delete(m.id);
            m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
        } else if (m.method === "Runtime.exceptionThrown") {
            st.exceptions.push("[" + st.phase + "] " + String(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || "").slice(0, 300));
        } else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
            st.consoleErrors.push("[" + st.phase + "] " + m.params.args.map(a => a.value ?? a.description ?? "").join(" ").slice(0, 300));
        }
    });
    await st.cdp("Runtime.enable");
    await st.cdp("Page.enable");
}

// node_modules/.bin/electron is a node wrapper — SIGKILLing it orphans the real
// Electron (which keeps holding the CDP port). Always reap by command line.
async function reap() {
    await sh("/usr/bin/pkill", ["-9", "-f", `remote-debugging-port=${PORT}`]);
    for (let i = 0; i < 20; i++) {
        try { await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); } catch (e) { return; }
        await delay(300);
    }
}

async function launch(ud) {
    await reap(); // never attach to a straggler from a previous phase
    return spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", `--remote-debugging-port=${PORT}`], {
        cwd: appDir,
        env: { ...process.env, DYOTERM_USER_DATA: ud, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" },
        stdio: ["ignore", "pipe", "pipe"]
    });
}

const shot = async (st, name) => {
    try {
        const s = await st.cdp("Page.captureScreenshot", { format: "png" });
        fs.writeFileSync(path.join(outDir, name), Buffer.from(s.data, "base64"));
    } catch (e) { /* screenshots are best effort */ }
};

// Read the whole visible+scrollback buffer of the focused pane
const BUF = `(()=>{const p=window.term.activeTab().focused;const b=p.term.buffer.active;let s='';for(let i=0;i<b.length;i++){const l=b.getLine(i);if(l)s+=l.translateToString(true)+'\\n';}return s;})()`;

// Prove the shell EXECUTED a command (not merely echoed it): the token is split by
// `""` on the command line, so it can only appear whole in the command's output.
async function echoProbe(st, tag, ms = 15000) {
    const tok = "dyoChaos_" + tag + "_" + Date.now().toString(36);
    const cmd = "echo " + tok.slice(0, 6) + '""' + tok.slice(6) + "\n";
    await st.ev(`window.dyo.pty.input(window.term.activeTab().focused.id, ${JSON.stringify(cmd)}); return true;`);
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
        const n = await st.ev(`return ${BUF}.split(${JSON.stringify(tok)}).length - 1;`);
        if (n >= 1) return { ok: true, detail: `output seen in ${Date.now() - t0}ms` };
        await delay(400);
    }
    const tail = await st.ev(`return ${BUF}.trim().split("\\n").slice(-6).join(" ⏎ ").slice(-400);`);
    return { ok: false, detail: `token '${tok}' never printed; buffer tail: ${tail}` };
}

// ================================================================= PHASE A ===
let mainLog = "";
let app = null;
const st = makeClient();

try {
    fs.rmSync(userData, { recursive: true, force: true });
    fs.mkdirSync(userData, { recursive: true });
    app = await launch(userData);
    app.stdout.on("data", d => mainLog += d);
    app.stderr.on("data", d => mainLog += d);
    const appExited = new Promise(res => app.on("exit", (code, signal) => res({ code, signal })));

    await attach(st);

    // ---- 1. boot ------------------------------------------------------------
    st.phase = "boot";
    await st.waitFor("!!(window.term && window.dash && window.ThemeEngine && window.ThemeEngine.current && window.I18N)", 40000, "app globals");
    await st.waitFor("!!(window.term.activeTab() && window.term.activeTab().focused && window.term.activeTab().focused.id)", 30000, "first pty");
    await delay(1500); // let the login shell settle + widgets mount
    const base = await st.ev(`return {
        tabs: window.term.tabs.length,
        panes: window.term.activeTab().panes().length,
        mounted: window.dash.mounted.size,
        items: document.querySelectorAll('.grid-stack-item').length,
        overlays: document.querySelectorAll('.overlay').length,
        theme: window.ThemeEngine.current, density: window.dash.density, lang: window.I18N.lang,
        widgetCount: Object.keys(window.WIDGETS).length,
        cols: window.term.activeTab().focused.term.cols,
        paneW: Math.round(window.term.activeTab().focused.el.getBoundingClientRect().width),
        hostW: Math.round(document.getElementById('panes').getBoundingClientRect().width)
    }`);
    check("boot: globals + first pty ready", base.tabs === 1 && base.mounted >= 3 && base.mounted === base.items,
        `tabs=${base.tabs} mounted=${base.mounted} items=${base.items} widgets=${base.widgetCount}`);
    const bootErrors = st.consoleErrors.length + st.exceptions.length;

    // ---- 2. tab storm: 8 tabs fast, then close fast -------------------------
    st.phase = "tab-storm";
    const opened = await st.ev(`for(let i=0;i<8;i++) window.term.newTab(); return window.term.tabs.length;`);
    check("tab-storm: 8 tabs opened synchronously", opened === 9, "tabs=" + opened);
    let ptyOk = false;
    try {
        ptyOk = await st.waitFor(`window.term.tabs.every(t=>t.panes().every(p=>!!p.id))`, 25000, "all 9 ptys");
    } catch (e) { ptyOk = false; }
    const idInfo = await st.ev(`const ids=[];window.term.tabs.forEach(t=>t.panes().forEach(p=>ids.push(p.id)));
        return {n:ids.length, nulls:ids.filter(x=>!x).length, uniq:new Set(ids).size};`);
    check("tab-storm: every rapid tab got a unique live pty", ptyOk && idInfo.nulls === 0 && idInfo.uniq === idInfo.n,
        `panes=${idInfo.n} nullIds=${idInfo.nulls} uniqueIds=${idInfo.uniq}`);
    await shot(st, "chaos-01-tabs.png");
    const closed = await st.ev(`while(window.term.tabs.length>1) window.term.closeTab(window.term.tabs.length-1);
        return {tabs: window.term.tabs.length, panesDom: document.querySelectorAll('#panes .pane').length, active: window.term.active};`);
    check("tab-storm: fast close returns to 1 tab, no orphan pane DOM", closed.tabs === 1 && closed.panesDom === 1 && closed.active === 0,
        `tabs=${closed.tabs} paneEls=${closed.panesDom} active=${closed.active}`);
    await delay(800);
    const aliveAfterStorm = await st.ev(`return !!(window.term.activeTab() && window.term.activeTab().focused && window.term.activeTab().focused.id)`);
    check("tab-storm: surviving tab still has a live pty", aliveAfterStorm === true, "focused.id=" + aliveAfterStorm);

    // ---- 3. deep split then unwind -----------------------------------------
    st.phase = "deep-split";
    for (const d of ["vertical", "horizontal", "vertical", "horizontal"]) {
        await st.ev(`window.term.splitFocused("${d}"); return true;`);
        await delay(350);
    }
    const deep = await st.ev(`const ps=window.term.activeTab().panes();
        return {n:ps.length, dom:window.term.activeTab().container.querySelectorAll('.pane').length};`);
    check("deep-split: 5 panes in one tab", deep.n === 5 && deep.dom === 5, `panes=${deep.n} domPanes=${deep.dom}`);
    let deepPty = false;
    try { deepPty = await st.waitFor(`window.term.activeTab().panes().every(p=>!!p.id)`, 20000, "5 ptys"); } catch (e) {}
    check("deep-split: all 5 panes have live ptys", deepPty === true);
    await shot(st, "chaos-02-deep-split.png");
    await st.ev(`for(let i=0;i<4;i++) window.term.closeFocusedPane(); return true;`);
    await delay(600);
    const unwound = await st.ev(`return {tabs:window.term.tabs.length, panes:window.term.activeTab().panes().length,
        dom:document.querySelectorAll('#panes .pane').length, focused: !!window.term.activeTab().focused};`);
    check("deep-split: unwind back to 1 pane, DOM clean", unwound.tabs === 1 && unwound.panes === 1 && unwound.dom === 1 && unwound.focused,
        `tabs=${unwound.tabs} panes=${unwound.panes} paneEls=${unwound.dom}`);
    // Geometry after the unwind: the sole surviving pane must fill the tab again.
    const geo = await st.ev(`const p=window.term.activeTab().focused;
        return {flex:p.el.style.flex, w:Math.round(p.el.getBoundingClientRect().width),
                host:Math.round(document.getElementById('panes').getBoundingClientRect().width), cols:p.term.cols};`);
    check("deep-split: sole surviving pane fills the tab area again",
        geo.w / geo.host > 0.97 && geo.cols >= base.cols - 2,
        `paneW=${geo.w}/${geo.host} (${(100 * geo.w / geo.host).toFixed(1)}%) inlineFlex='${geo.flex}' cols=${geo.cols} bootCols=${base.cols}`);
    await shot(st, "chaos-02b-after-unwind.png");
    // Minimal repro of the same thing: one split, close the new pane.
    const reclaim = await st.ev(`
        window.term.splitFocused("vertical");
        await new Promise(r=>setTimeout(r,700));
        const two = window.term.activeTab().panes().length;
        window.term.closeFocusedPane();
        await new Promise(r=>setTimeout(r,600));
        const p = window.term.activeTab().focused;
        return {two, panes: window.term.activeTab().panes().length, flex: p.el.style.flex,
                w: Math.round(p.el.getBoundingClientRect().width),
                host: Math.round(document.getElementById('panes').getBoundingClientRect().width), cols: p.term.cols};`);
    check("split→close (minimal): survivor reclaims the full width",
        reclaim.two === 2 && reclaim.panes === 1 && reclaim.w / reclaim.host > 0.97,
        `paneW=${reclaim.w}/${reclaim.host} (${(100 * reclaim.w / reclaim.host).toFixed(1)}%) inlineFlex='${reclaim.flex}' cols=${reclaim.cols}`);

    // ---- 4. widget add/remove leak hunt (15 rounds) -------------------------
    st.phase = "widget-leak";
    // local-only widgets: remote-dependent ones would spew network console errors
    const pool = await st.ev(`return Object.keys(window.WIDGETS).filter(id=>!/^(ci-|ops-|web-|sec-|netx-|dbx-|ct-|ssh|db$|k8s|cloud)/.test(id));`);
    const picks = [];
    for (let i = 0; i < 15; i++) picks.push(pool[Math.floor(Math.random() * pool.length)]);
    console.log("      leak-loop widgets:", picks.join(", "));
    let leakBad = null;
    for (let i = 0; i < picks.length; i++) {
        const r = await st.ev(`
            const before = {m: window.dash.mounted.size, i: document.querySelectorAll('.grid-stack-item').length};
            window.dash.addWidget(${JSON.stringify(picks[i])}, {autoPosition:true}, true);
            await new Promise(r=>setTimeout(r,180));
            const mid = {m: window.dash.mounted.size, i: document.querySelectorAll('.grid-stack-item').length};
            const item = [...window.dash.mounted.keys()].pop();
            window.dash.removeItem(item);
            await new Promise(r=>setTimeout(r,220));
            const after = {m: window.dash.mounted.size, i: document.querySelectorAll('.grid-stack-item').length};
            return {before, mid, after};`);
        if (r.mid.m !== r.before.m + 1 || r.mid.i !== r.before.i + 1 ||
            r.after.m !== base.mounted || r.after.i !== base.items) {
            leakBad = { round: i + 1, widget: picks[i], ...r };
            break;
        }
    }
    const leakEnd = await st.ev(`return {m:window.dash.mounted.size, i:document.querySelectorAll('.grid-stack-item').length,
        engine: window.dash.grid.engine.nodes.length};`);
    check("widget-leak: 15x add/remove returns exactly to baseline",
        !leakBad && leakEnd.m === base.mounted && leakEnd.i === base.items && leakEnd.engine === base.mounted,
        leakBad ? `round ${leakBad.round} (${leakBad.widget}) ${JSON.stringify(leakBad)}`
            : `mounted=${leakEnd.m}/${base.mounted} items=${leakEnd.i}/${base.items} gridNodes=${leakEnd.engine}`);

    // ---- 5. theme / density / language interleave x20 -----------------------
    st.phase = "toggle-storm";
    const tog = await st.ev(`
        const themes = Object.keys(window.ThemeEngine.themes);
        const dens = ["compact","comfortable","spacious"];
        const langs = Object.keys(window.I18N.dict);
        for (let i=0;i<20;i++) {
            window.ThemeEngine.apply(themes[i % themes.length]);
            window.dash.setDensity(dens[i % dens.length]);
            window.I18N.set(langs[i % langs.length]);
        }
        window.ThemeEngine.apply(${JSON.stringify(base.theme)});
        window.dash.setDensity(${JSON.stringify(base.density)});
        window.I18N.set("en");
        await new Promise(r=>setTimeout(r,600));
        return {
            themes: themes.length, langs: langs.length,
            accent: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
            densityClasses: [...document.body.classList].filter(c=>c.startsWith("density-")),
            lang: window.I18N.lang, theme: window.ThemeEngine.current,
            mounted: window.dash.mounted.size, items: document.querySelectorAll('.grid-stack-item').length,
            cols: window.dash.grid.getColumn(),
            paneCount: window.term.activeTab().panes().length
        };`);
    check("toggle-storm: 20x theme+density+lang leaves consistent state",
        !!tog.accent && tog.densityClasses.length === 1 && tog.lang === "en" && tog.theme === base.theme &&
        tog.mounted === base.mounted && tog.items === base.items && tog.cols >= 12,
        `accent=${tog.accent} densityClasses=${JSON.stringify(tog.densityClasses)} lang=${tog.lang} theme=${tog.theme} mounted=${tog.mounted} items=${tog.items} cols=${tog.cols}`);
    await shot(st, "chaos-03-after-toggles.png");

    // ---- 6. wheel storm ------------------------------------------------------
    st.phase = "wheel-storm";
    await st.ev(`window.dyo.pty.input(window.term.activeTab().focused.id, "seq 1 400\\n"); return true;`);
    // wait for real scrollback (not the echoed command line) before touching the wheel
    await st.waitFor(`window.term.activeTab().focused.term.buffer.active.baseY > 300`, 25000, "seq scrollback");
    await delay(500);
    const wheel = await st.ev(`
        const p = window.term.activeTab().focused;
        const host = p.host;
        const b = () => p.term.buffer.active;
        const start = {viewportY: b().viewportY, baseY: b().baseY, type: b().type};
        const fire = (dy) => host.dispatchEvent(new WheelEvent("wheel", {deltaY:dy, deltaMode:0, bubbles:true, cancelable:true}));
        for (let i=0;i<150;i++) fire(-120);
        const afterUp = {viewportY: b().viewportY, baseY: b().baseY};
        for (let i=0;i<50;i++) fire(120);
        await new Promise(r=>setTimeout(r,150));
        const afterDown = {viewportY: b().viewportY, baseY: b().baseY, length: b().length, rows: p.term.rows, cols: p.term.cols};
        return {start, afterUp, afterDown};`);
    const w = wheel.afterDown;
    check("wheel-storm: 200 wheel events keep the viewport consistent",
        wheel.start.baseY > 300 && wheel.afterUp.viewportY === 0 && wheel.afterUp.viewportY < wheel.start.viewportY &&
        w.viewportY > 0 && Number.isInteger(w.viewportY) && w.viewportY <= w.baseY && w.baseY === wheel.start.baseY &&
        w.baseY + w.rows <= w.length,
        `startViewportY=${wheel.start.viewportY} baseY=${wheel.start.baseY} afterUp=${wheel.afterUp.viewportY} afterDown=${w.viewportY}/${w.baseY} len=${w.length} rows=${w.rows} cols=${w.cols}`);
    await st.ev(`window.term.activeTab().focused.term.scrollToBottom(); return true;`);
    const afterWheel = await echoProbe(st, "wheel");
    check("wheel-storm: terminal still echoes a command afterwards", afterWheel.ok, afterWheel.detail);

    // ---- 7. synthetic paste storm (no real clipboard) ----------------------
    st.phase = "paste-storm";
    const burst = await st.ev(`
        const pane = window.term.activeTab().focused;
        pane.focus();
        const ta = pane.host.querySelector('.xterm-helper-textarea');
        if (!ta) return {error:'no helper textarea'};
        let sink = "";
        const d = pane.term.onData(x => { sink += x; });
        const firePaste = (txt) => {
            const dt = new DataTransfer(); dt.setData('text/plain', txt);
            const e = new ClipboardEvent('paste', {clipboardData: dt, bubbles:true, cancelable:true});
            if (!e.clipboardData) Object.defineProperty(e, 'clipboardData', {value: dt});
            ta.dispatchEvent(new KeyboardEvent('keydown',{key:'v',code:'KeyV',metaKey:true,bubbles:true,cancelable:true}));
            ta.dispatchEvent(e);
        };
        const toks = [];
        for (let i=0;i<12;i++) toks.push("CHZ"+i+"_"+Math.random().toString(36).slice(2,7));
        toks.forEach(firePaste);                       // no gap at all — hostile timing
        await new Promise(r=>setTimeout(r,400));
        const counts = toks.map(t => sink.split(t).length - 1);
        // dedupe probe: identical text twice inside the 80ms window must land once
        const dup = "CHZDUP_"+Math.random().toString(36).slice(2,7);
        firePaste(dup); firePaste(dup);
        await new Promise(r=>setTimeout(r,400));
        const dupCount = sink.split(dup).length - 1;
        d.dispose();
        return {counts, dupCount, guards: document.querySelectorAll('.paste-guard').length, overlays: document.querySelectorAll('.overlay').length};`);
    check("paste-storm: 12 back-to-back synthetic pastes each land exactly once",
        !burst.error && Array.isArray(burst.counts) && burst.counts.length === 12 && burst.counts.every(c => c === 1),
        burst.error || "counts=" + JSON.stringify(burst.counts));
    check("paste-storm: identical paste inside the 80ms window is not doubled",
        burst.dupCount === 1 && burst.guards === 0, `dupCount=${burst.dupCount} pasteGuards=${burst.guards} overlays=${burst.overlays}`);
    // clear whatever landed on the prompt line
    await st.ev(`window.dyo.pty.input(window.term.activeTab().focused.id, "\\u0003"); return true;`);
    await delay(400);

    // ---- 8. SIGKILL live shells ---------------------------------------------
    st.phase = "sigkill";
    await st.ev(`window.term.splitFocused("vertical"); return true;`); await delay(500);
    await st.ev(`window.term.splitFocused("horizontal"); return true;`); await delay(700);
    await st.waitFor(`window.term.activeTab().panes().every(p=>!!p.id)`, 20000, "3 ptys for sigkill");
    // ask each pane's shell for its own pid
    const pids = await st.ev(`
        const panes = window.term.activeTab().panes();
        panes.forEach((p,i)=> window.dyo.pty.input(p.id, "echo DYOPID"+i+":$$:\\n"));
        await new Promise(r=>setTimeout(r,2500));
        return panes.map((p,i)=>{
            const b=p.term.buffer.active; let s='';
            for(let j=0;j<b.length;j++){const l=b.getLine(j); if(l) s+=l.translateToString(true)+'\\n';}
            const m = s.match(new RegExp("DYOPID"+i+":(\\\\d+):"));
            return {ptyId: p.id, pid: m ? Number(m[1]) : null};
        });`);
    const gotPids = pids.filter(p => p.pid);
    check("sigkill: read real shell pids out of 3 live panes", gotPids.length === 3, JSON.stringify(pids));
    let ppid = null;
    if (gotPids.length) {
        const r = await sh("/bin/ps", ["-o", "ppid=", "-p", String(gotPids[0].pid)]);
        ppid = Number(r.out.trim()) || null;
    }
    const victims = gotPids.slice(0, 2).map(p => p.pid);
    for (const pid of victims) { try { process.kill(pid, "SIGKILL"); } catch (e) { console.log("      kill failed", pid, e.message); } }
    await delay(2500);
    const survived = await st.ev(`return {
        tabs: window.term.tabs.length,
        panes: window.term.activeTab().panes().length,
        domPanes: document.querySelectorAll('#panes .pane').length,
        focusedId: window.term.activeTab().focused ? window.term.activeTab().focused.id : null,
        mounted: window.dash.mounted.size };`);
    check("sigkill: app survives, killed panes closed, no zombie pane DOM",
        survived.tabs === 1 && survived.panes === 1 && survived.domPanes === 1 && !!survived.focusedId,
        `tabs=${survived.tabs} panes=${survived.panes} paneEls=${survived.domPanes} focusedPty=${survived.focusedId}`);
    let stillAround = [];
    for (const pid of victims) {
        const r = await sh("/bin/ps", ["-o", "pid=,stat=", "-p", String(pid)]);
        if (r.out.trim()) stillAround.push(r.out.trim());
    }
    check("sigkill: killed shells fully reaped (no zombies)", stillAround.length === 0, stillAround.join(" | ") || "none");
    // orphan-shell leak: shells still parented to the electron main process vs live panes
    let orphan = "n/a";
    if (ppid) {
        const r = await sh("/bin/ps", ["-eo", "ppid=,pid=,comm="]);
        const kids = r.out.split("\n").map(l => l.trim()).filter(Boolean)
            .map(l => l.split(/\s+/)).filter(a => Number(a[0]) === ppid)
            .filter(a => /(zsh|bash|sh|fish)$/.test(a.slice(2).join(" ")));
        const live = await st.ev(`let n=0; window.term.tabs.forEach(t=>n+=t.panes().length); return n;`);
        orphan = `shells=${kids.length} livePanes=${live}`;
        check("sigkill: no orphaned shells left after all the churn", kids.length === live, orphan);
    } else {
        check("sigkill: no orphaned shells left after all the churn", false, "could not resolve electron main pid");
    }
    const afterKill = await echoProbe(st, "afterkill");
    check("sigkill: surviving pane still interactive", afterKill.ok, afterKill.detail);
    await shot(st, "chaos-04-after-sigkill.png");

    // ---- 9. catalog thrash ---------------------------------------------------
    st.phase = "catalog";
    const cat = await st.ev(`
        for (let i=0;i<10;i++){ window.dash.openCatalog(); document.getElementById('catalog-overlay').classList.remove('open'); }
        await new Promise(r=>setTimeout(r,300));
        window.dash.openCatalog();
        const items = document.querySelectorAll('#catalog-body .cat-item').length;
        document.getElementById('catalog-overlay').classList.remove('open');
        return {items, overlayEls: document.querySelectorAll('#catalog-overlay').length,
                overlays: document.querySelectorAll('.overlay').length,
                mounted: window.dash.mounted.size, gridItems: document.querySelectorAll('.grid-stack-item').length};`);
    check("catalog: 10x open/close leaves one overlay and a full catalog",
        cat.overlayEls === 1 && cat.items >= 8 && cat.overlays === base.overlays && cat.mounted === base.mounted && cat.gridItems === base.items,
        `catItems=${cat.items} catalogEls=${cat.overlayEls} overlays=${cat.overlays}/${base.overlays} mounted=${cat.mounted} gridItems=${cat.gridItems}`);

    // ---- 10. final health ---------------------------------------------------
    st.phase = "final";
    const finalEcho = await echoProbe(st, "final");
    check("final: terminal still echoes after the whole sweep", finalEcho.ok, finalEcho.detail);
    await shot(st, "chaos-05-final.png");
    const errDelta = (st.consoleErrors.length + st.exceptions.length) - bootErrors;
    check("final: zero console errors / exceptions triggered by the sweep", errDelta === 0,
        errDelta === 0 ? "0" : JSON.stringify([...st.consoleErrors, ...st.exceptions].slice(-8)));

    // ---- 11. clean quit ------------------------------------------------------
    try { await st.ev(`window.dyo.win("close"); return true;`); } catch (e) { /* may die before replying */ }
    try { st.ws.close(); } catch (e) {}
    const res = await Promise.race([appExited, delay(20000).then(() => null)]);
    if (!res) { await reap(); await appExited; }
    check("quit: clean exit after the chaos sweep", !!res && res.code === 0 && !res.signal,
        res ? `code=${res.code} signal=${res.signal}` : "hang (20s)");
    app = null;
} catch (e) {
    check("phase-A harness", false, "fatal: " + String(e.message || e).slice(0, 400));
    console.error(e);
} finally {
    if (app) { await reap(); try { app.kill("SIGKILL"); } catch (e) {} }
}

// ================================================================= PHASE B ===
// 3 rapid boot->quit cycles (teardown-race hunt on top of the v0.5.6 fix)
for (let n = 1; n <= 3; n++) {
    const ud = path.join(outDir, "e2e-chaos-ud-cycle");
    fs.rmSync(ud, { recursive: true, force: true }); fs.mkdirSync(ud, { recursive: true });
    const a = await launch(ud);
    let log = "";
    a.stdout.on("data", d => log += d); a.stderr.on("data", d => log += d);
    const exited = new Promise(r => a.on("exit", (code, signal) => r({ code, signal })));
    const c = makeClient();
    try {
        await attach(c);
        await c.waitFor("!!(window.term && window.term.activeTab() && window.term.activeTab().focused && window.term.activeTab().focused.id)", 40000, "boot");
        // extra live ptys => more exit watchers racing teardown
        await c.ev("window.term.newTab(); window.term.splitFocused('vertical'); return true;");
        await delay(900);
        await c.ev("window.term.splitFocused('horizontal'); return true;");
        await delay(400);
        try { await c.ev(`window.dyo.win("close"); return true;`); } catch (e) {}
        try { c.ws.close(); } catch (e) {}
    } catch (e) {
        await reap(); try { a.kill("SIGKILL"); } catch (err) {}
        check(`cycle ${n}: boot->quit exit 0 / signal null`, false, "harness: " + String(e.message).slice(0, 160));
        await exited;
        continue;
    }
    const r = await Promise.race([exited, delay(20000).then(() => null)]);
    if (!r) { await reap(); await exited; check(`cycle ${n}: boot->quit exit 0 / signal null`, false, "hang (20s)"); continue; }
    check(`cycle ${n}: boot->quit exit 0 / signal null`, r.code === 0 && !r.signal,
        `code=${r.code} signal=${r.signal}` + (r.code === 0 && !r.signal ? "" : " tail=" + log.split("\n").slice(-6).join(" | ").slice(0, 300)));
}

fs.writeFileSync(path.join(outDir, "e2e-chaos-report.json"), JSON.stringify({
    results, consoleErrors: st.consoleErrors, exceptions: st.exceptions,
    mainLog: mainLog.split("\n").slice(-40).join("\n")
}, null, 2));
if (st.consoleErrors.length || st.exceptions.length) {
    console.log("\nconsole errors / exceptions:");
    [...st.consoleErrors, ...st.exceptions].forEach(e => console.log("  " + e));
}
console.log(pass ? "\nALL PASS" : "\nFAILURES");
process.exit(pass ? 0 : 1);
