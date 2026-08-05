// e2e-journey.mjs — realistic power-user journey through dyo-term, one long session.
// boot -> shell IO -> splits/focus/zoom -> tabs (create/rename/close) -> command palette
// -> widget catalog (search/add/collapse/mouse-resize/drag-move/close) -> themes -> i18n
// -> density -> dock 4 sides -> window sizes incl. 5120x1440 ultrawide -> clean quit.
// Launches in background (no focus steal). Honest exit code: 0 only if every check passed.
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(appDir, ".smoke");
const userData = path.join(outDir, "e2e-journey-ud");
fs.rmSync(userData, { recursive: true, force: true });
fs.mkdirSync(userData, { recursive: true });
const PORT = 9411;
const report = { run: "journey", scenarios: [], consoleErrors: [], exceptions: [], notes: [] };

const app = spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", `--remote-debugging-port=${PORT}`], {
    cwd: appDir,
    env: { ...process.env, DYOTERM_USER_DATA: userData, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" },
    stdio: ["ignore", "pipe", "pipe"]
});
let mainLog = "", exitInfo = null;
app.stdout.on("data", d => mainLog += d);
app.stderr.on("data", d => mainLog += d);
app.on("exit", (code, signal) => { exitInfo = { code, signal }; });

const delay = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0;
const pend = new Map();
const cdp = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params }));
    setTimeout(() => { if (pend.has(i)) { pend.delete(i); rej(new Error("timeout " + method)); } }, 20000);
});
// ev: run an async body ({...; return x}) in the page
const ev = (body) => cdp("Runtime.evaluate", { expression: `(async()=>{${body}})()`, returnByValue: true, awaitPromise: true })
    .then(r => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; });
const waitFor = async (body, ms, label) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { try { if (await ev(body)) return true; } catch (e) {} await delay(400); }
    throw new Error("timeout waiting: " + (label || body));
};
async function scenario(name, fn) {
    const e = { name, ok: false };
    try { e.detail = await fn(); e.ok = true; console.log("PASS", name, e.detail ? "::" : "", e.detail || ""); }
    catch (err) { e.detail = String(err.message || err).slice(0, 400); console.log("FAIL", name, "::", e.detail); }
    report.scenarios.push(e);
}
async function shot(name) {
    try {
        const s = await cdp("Page.captureScreenshot", { format: "png" });
        fs.writeFileSync(path.join(outDir, `e2e-journey-${name}.png`), Buffer.from(s.data, "base64"));
    } catch (e) { report.notes.push("screenshot " + name + " failed: " + e.message); }
}
const drag = async (x0, y0, x1, y1) => {
    await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0, y: y0 });
    await delay(150); // gridstack autohide hover-in
    await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: x0, y: y0, button: "left", buttons: 1, clickCount: 1 });
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
        await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0 + (x1 - x0) * i / steps, y: y0 + (y1 - y0) * i / steps, button: "left", buttons: 1 });
        await delay(30);
    }
    await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: x1, y: y1, button: "left", buttons: 1, clickCount: 1 });
    await delay(600); // commit + change event
};
// buffer text of the focused pane
const BUF = `const p=window.term.activeTab().focused;const b=p.term.buffer.active;let s='';for(let i=0;i<b.length;i++){const l=b.getLine(i);if(l)s+=l.translateToString(true)+'\\n';}return s;`;
// pane geometry of the active tab
const GEO = `const t=window.term.activeTab();return t.panes().map(p=>{const r=p.el.getBoundingClientRect();return {id:p.id,x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),cx:Math.round(r.x+r.width/2),cy:Math.round(r.y+r.height/2),focused:p===t.focused};});`;
// run one palette action end-to-end through the real palette UI (typed query + Enter)
const paletteRun = async (actionId) => {
    const label = await ev(`return window.I18N.t((window.__actions.find(a=>a.id==="${actionId}")||{}).label);`);
    if (!label) throw new Error("no action " + actionId);
    await ev(`window.Palette.open(); return true;`);
    await delay(150);
    const openOk = await ev(`return !!document.querySelector(".palette-overlay") && !!document.querySelector(".palette-input");`);
    if (!openOk) throw new Error("palette did not open");
    await ev(`const i=document.querySelector(".palette-input"); i.value=${JSON.stringify(label)}; i.dispatchEvent(new Event("input",{bubbles:true})); return true;`);
    await delay(120);
    const top = await ev(`const r=document.querySelector(".palette-row.sel .p-label");return r?r.textContent:null;`);
    if (top !== label) throw new Error(`top palette match for "${label}" is "${top}"`);
    await ev(`document.querySelector(".palette-input").dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true})); return true;`);
    await delay(250);
    const closed = await ev(`return !document.querySelector(".palette-overlay");`);
    if (!closed) throw new Error("palette did not close after Enter");
    return label;
};

try {
    let target = null;
    for (let i = 0; i < 60 && !target; i++) {
        try {
            const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
            target = list.find(t => t.type === "page" && (t.url || "").includes("index.html"));
        } catch (e) {}
        await delay(800);
    }
    if (!target) throw new Error("no page target");
    ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 256 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    ws.on("message", raw => {
        const m = JSON.parse(raw);
        if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
        else if (m.method === "Runtime.exceptionThrown") report.exceptions.push((m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || "").slice(0, 300));
        else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") report.consoleErrors.push(m.params.args.map(a => a.value ?? a.description ?? "").join(" ").slice(0, 300));
    });
    await cdp("Runtime.enable");
    await cdp("Page.enable");

    // ---------------------------------------------------------------- 1. boot
    await scenario("boot", async () => {
        await waitFor(`return !!(window.term && window.dash && window.dash.grid && window.ThemeEngine && window.ThemeEngine.current && window.I18N && window.Palette);`, 30000, "app boot");
        const r = await ev(`return {theme:window.ThemeEngine.current, tabs:window.term.tabs.length, lang:window.I18N.lang, widgets:document.querySelectorAll(".grid-stack .widget").length};`);
        if (r.tabs < 1 || r.widgets < 3) throw new Error("boot state " + JSON.stringify(r));
        return JSON.stringify(r);
    });
    await shot("01-boot");

    // ------------------------------------------------- 2. real shell commands
    await scenario("shell-echo-output", async () => {
        await waitFor(`return !!(window.term.activeTab() && window.term.activeTab().focused && window.term.activeTab().focused.id);`, 15000, "pty ready");
        await delay(1500); // login shell first prompt
        const marker = "journey_" + Date.now();
        // $((6*7)) proves the shell evaluated the line, not merely echoed it back
        await ev(`window.dyo.pty.input(window.term.activeTab().focused.id, "echo ${marker}_$((6*7))\\n"); return true;`);
        await waitFor(`${BUF.replace("return s;", "")}return s.includes("${marker}_42");`, 15000, "arithmetic echo output");
        return "shell evaluated echo " + marker + "_42";
    });
    await scenario("shell-cwd-pwd", async () => {
        // typed line shows $(pwd)/$(ls...), only real shell evaluation prints the composed marker
        await ev(`window.dyo.pty.input(window.term.activeTab().focused.id, "cd /tmp && echo \\"cwd=$(pwd);pkg=$(ls ${appDir} | grep -c package.json)\\"\\n"); return true;`);
        await waitFor(`${BUF.replace("return s;", "")}return s.includes("cwd=/tmp;pkg=1");`, 15000, "pwd + ls output");
        return "cd /tmp && pwd -> cwd=/tmp; ls | grep -c package.json -> 1";
    });

    // -------------------------------------------------- 3. splits, focus, zoom
    await scenario("split-vertical", async () => {
        await ev(`window.term.splitFocused("vertical"); return true;`);
        await delay(700);
        const n = await ev(`return window.term.activeTab().panes().length;`);
        if (n !== 2) throw new Error("expected 2 panes, got " + n);
        const g = await ev(GEO);
        if (!(g[1].x > g[0].x || g[0].x > g[1].x)) throw new Error("panes not side by side: " + JSON.stringify(g));
        return "2 panes side by side";
    });
    await scenario("split-horizontal", async () => {
        await ev(`window.term.splitFocused("horizontal"); return true;`);
        await delay(700);
        const g = await ev(GEO);
        if (g.length !== 3) throw new Error("expected 3 panes, got " + g.length);
        const ys = new Set(g.map(p => p.y));
        if (ys.size < 2) throw new Error("no vertical stacking after horizontal split: " + JSON.stringify(g));
        return "3 panes (one column split into rows)";
    });
    await scenario("pane-focus-directional", async () => {
        let g = await ev(GEO);
        // focus the bottom-right-most pane explicitly
        const br = g.slice().sort((a, b) => (b.cx + b.cy) - (a.cx + a.cy))[0];
        await ev(`const t=window.term.activeTab();const p=t.panes().find(p=>p.id===${JSON.stringify(br.id)});window.term.focusPane(p);return true;`);
        await ev(`window.term.focusDir("left"); return true;`); await delay(200);
        g = await ev(GEO);
        const afterLeft = g.find(p => p.focused);
        if (!afterLeft || afterLeft.cx >= br.cx) throw new Error(`focusDir(left) did not move left: from cx=${br.cx} to ${JSON.stringify(afterLeft)}`);
        await ev(`window.term.focusDir("right"); return true;`); await delay(200);
        g = await ev(GEO);
        const afterRight = g.find(p => p.focused);
        if (!afterRight || afterRight.cx <= afterLeft.cx) throw new Error(`focusDir(right) did not move right: ${JSON.stringify(g)}`);
        // two panes stacked on the right: up should decrease cy or stay if already top
        const rightCol = g.filter(p => p.cx === afterRight.cx);
        let vertMsg = "right column single";
        if (rightCol.length >= 2) {
            await ev(`window.term.focusDir(${JSON.stringify(afterRight.cy > Math.min(...rightCol.map(p => p.cy)) ? "up" : "down")}); return true;`);
            await delay(200);
            g = await ev(GEO);
            const afterVert = g.find(p => p.focused);
            if (afterVert.cy === afterRight.cy) throw new Error("vertical focusDir did not change pane: " + JSON.stringify(g));
            vertMsg = `vertical move cy ${afterRight.cy}->${afterVert.cy}`;
        }
        return `left cx ${br.cx}->${afterLeft.cx}, right cx ->${afterRight.cx}, ${vertMsg}`;
    });
    await scenario("pane-zoom-unzoom", async () => {
        const before = await ev(GEO);
        const foc = before.find(p => p.focused);
        await ev(`window.term.toggleZoom(); return true;`);
        await delay(500);
        const z = await ev(`const t=window.term.activeTab();const cr=t.container.getBoundingClientRect();const fr=t.focused.el.getBoundingClientRect();return {zoomed:t.zoomed,cls:t.container.classList.contains("zoomed"),tgt:t.focused.el.classList.contains("zoom-target"),cw:Math.round(cr.width),fw:Math.round(fr.width),ch:Math.round(cr.height),fh:Math.round(fr.height)};`);
        if (!z.zoomed || !z.cls || !z.tgt) throw new Error("zoom state wrong: " + JSON.stringify(z));
        if (Math.abs(z.cw - z.fw) > 8 || Math.abs(z.ch - z.fh) > 8) throw new Error(`zoomed pane does not fill tab: pane ${z.fw}x${z.fh} vs container ${z.cw}x${z.ch}`);
        await ev(`window.term.toggleZoom(); return true;`);
        await delay(500);
        const u = await ev(`const t=window.term.activeTab();return {zoomed:t.zoomed,cls:t.container.classList.contains("zoomed"),panes:t.panes().length};`);
        if (u.zoomed || u.cls || u.panes !== 3) throw new Error("unzoom state wrong: " + JSON.stringify(u));
        const after = await ev(GEO);
        const focAfter = after.find(p => p.id === foc.id);
        if (!focAfter || Math.abs(focAfter.w - foc.w) > 8) throw new Error(`split not restored after unzoom: ${JSON.stringify(foc)} vs ${JSON.stringify(focAfter)}`);
        return `zoom filled ${z.fw}x${z.fh}, unzoom restored 3-pane split`;
    });
    await shot("02-splits");

    // ------------------------------------------------------------------ 4. tabs
    await scenario("tabs-create-rename-close", async () => {
        await ev(`window.term.newTab(); return true;`); await delay(500);
        await ev(`window.term.newTab(); return true;`); await delay(500);
        let n = await ev(`return window.term.tabs.length;`);
        if (n !== 3) throw new Error("expected 3 tabs, got " + n);
        const label0 = await ev(`return document.querySelectorAll("#tabbar .tab .label")[0].textContent;`);
        // rename the active (3rd) tab through the real inline-rename UI
        await ev(`window.term.renameActiveTab(); return true;`); await delay(200);
        const hasInput = await ev(`return !!document.querySelector("#tabbar .tab-rename");`);
        if (!hasInput) throw new Error("rename input did not appear");
        await ev(`const i=document.querySelector("#tabbar .tab-rename"); i.value="deploys"; i.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true})); return true;`);
        await delay(300);
        let labels = await ev(`return [...document.querySelectorAll("#tabbar .tab .label")].map(e=>e.textContent);`);
        if (labels[2] !== "deploys") throw new Error("rename failed, labels=" + JSON.stringify(labels));
        // close the middle tab
        await ev(`window.term.closeTab(1); return true;`); await delay(500);
        n = await ev(`return window.term.tabs.length;`);
        labels = await ev(`return [...document.querySelectorAll("#tabbar .tab .label")].map(e=>e.textContent);`);
        if (n !== 2 || labels.length !== 2 || !labels.includes("deploys")) throw new Error(`after close: tabs=${n} labels=${JSON.stringify(labels)}`);
        // first tab label is cwd-based (home "~" or a path basename or OSC title), never empty
        if (!labels[0] || !labels[0].trim()) throw new Error("first tab label empty");
        return `labels ${JSON.stringify(labels)} (tab0 cwd-based was ${JSON.stringify(label0)}, renamed kept)`;
    });

    // ------------------------------------------------------------ 5. palette
    await scenario("palette-open-and-list", async () => {
        await ev(`window.Palette.open(); return true;`); await delay(200);
        const st = await ev(`return {open:window.Palette.isOpen(),rows:document.querySelectorAll(".palette-row").length,actions:(window.__actions||[]).length};`);
        await ev(`window.Palette.close(); return true;`);
        if (!st.open || st.rows < 20 || st.actions < 25) throw new Error("palette state " + JSON.stringify(st));
        return `${st.rows} rows for ${st.actions} actions`;
    });
    await scenario("palette-run-actions", async () => {
        // action 1: new tab via palette
        const tabsBefore = await ev(`return window.term.tabs.length;`);
        const l1 = await paletteRun("newTab");
        const tabsAfter = await ev(`return window.term.tabs.length;`);
        if (tabsAfter !== tabsBefore + 1) throw new Error(`palette "${l1}": tabs ${tabsBefore}->${tabsAfter}`);
        // action 2: toggle widget edit mode via palette (on, then off again)
        const l2 = await paletteRun("editWidgets");
        const editing = await ev(`return document.body.classList.contains("editing");`);
        if (!editing) throw new Error(`palette "${l2}" did not enter edit mode`);
        await paletteRun("editWidgets");
        const editing2 = await ev(`return document.body.classList.contains("editing");`);
        if (editing2) throw new Error("second editWidgets did not leave edit mode");
        // action 3: cycle dashboard dock via palette (4x -> back to start)
        const dock0 = await ev(`return window.__dashDock();`);
        const l3 = await paletteRun("dockCycle");
        const dock1 = await ev(`return window.__dashDock();`);
        if (dock1 === dock0) throw new Error(`palette "${l3}" did not change dock (${dock0})`);
        for (let i = 0; i < 3; i++) await paletteRun("dockCycle");
        const dockN = await ev(`return window.__dashDock();`);
        if (dockN !== dock0) throw new Error(`dock did not cycle home: ${dock0} -> ${dockN}`);
        return `ran "${l1}", "${l2}"x2, "${l3}"x4; tabs ${tabsBefore}->${tabsAfter}, dock ${dock0}->${dock1}->${dockN}`;
    });

    // --------------------------------------------------------- 6. widget catalog
    await scenario("catalog-search", async () => {
        await ev(`window.dash.openCatalog(); return true;`); await delay(300);
        const total = await ev(`return document.querySelectorAll("#catalog-body .cat-item").length;`);
        if (total < 100) throw new Error("catalog too small: " + total);
        await ev(`const s=document.querySelector("#catalog-search"); s.value="docker"; s.dispatchEvent(new Event("input",{bubbles:true})); return true;`);
        await delay(200);
        const f = await ev(`return {n:document.querySelectorAll("#catalog-body .cat-item").length, ids:[...document.querySelectorAll("#catalog-body .cat-item")].slice(0,8).map(e=>e.dataset.id)};`);
        if (!(f.n > 0 && f.n < total)) throw new Error(`search "docker" filter: ${f.n}/${total}`);
        await ev(`const s=document.querySelector("#catalog-search"); s.value=""; s.dispatchEvent(new Event("input",{bubbles:true})); document.getElementById("catalog-overlay").classList.remove("open"); return true;`);
        return `search "docker": ${f.n}/${total} items (${f.ids.slice(0, 4).join(",")}...)`;
    });
    await scenario("catalog-add-git-db-notes-clock", async () => {
        const added = [];
        for (const wid of ["git", "db", "notes", "clock"]) {
            const before = await ev(`return document.querySelectorAll(".grid-stack .widget").length;`);
            await ev(`window.dash.openCatalog(); return true;`); await delay(250);
            await ev(`const s=document.querySelector("#catalog-search"); s.value=${JSON.stringify(wid)}; s.dispatchEvent(new Event("input",{bubbles:true})); return true;`);
            await delay(200);
            const clicked = await ev(`const el=[...document.querySelectorAll("#catalog-body .cat-item")].find(e=>e.dataset.id===${JSON.stringify(wid)}); if(!el) return false; el.click(); return true;`);
            if (!clicked) throw new Error("catalog item not found for " + wid);
            await delay(400);
            const after = await ev(`return document.querySelectorAll(".grid-stack .widget").length;`);
            const catClosed = await ev(`return !document.getElementById("catalog-overlay").classList.contains("open");`);
            if (after !== before + 1) throw new Error(`${wid}: widget count ${before}->${after}`);
            if (!catClosed) throw new Error(`catalog stayed open after adding ${wid}`);
            added.push(wid);
        }
        return "added via catalog click: " + added.join(", ");
    });
    await scenario("widget-collapse-expand", async () => {
        const st0 = await ev(`let el=null;window.dash.mounted.forEach((rec,item)=>{if(rec.widgetId==="git")el=item;});if(!el)return null;el.id="j-git";return {h:+el.getAttribute("gs-h")||1,collapsed:el.classList.contains("apw-collapsed")};`);
        if (!st0) throw new Error("git widget item not found in dash.mounted");
        await ev(`document.querySelector("#j-git .w-collapse").click(); return true;`); await delay(400);
        const st1 = await ev(`const el=document.getElementById("j-git");return {h:+el.getAttribute("gs-h")||1,collapsed:el.classList.contains("apw-collapsed")};`);
        if (!st1.collapsed || st1.h !== 1) throw new Error("collapse failed: " + JSON.stringify(st1));
        await ev(`document.querySelector("#j-git .w-collapse").click(); return true;`); await delay(400);
        const st2 = await ev(`const el=document.getElementById("j-git");return {h:+el.getAttribute("gs-h")||1,collapsed:el.classList.contains("apw-collapsed")};`);
        if (st2.collapsed || st2.h !== st0.h) throw new Error(`expand failed: was h=${st0.h}, now ${JSON.stringify(st2)}`);
        return `h ${st0.h} -> collapsed 1 -> restored ${st2.h}`;
    });

    // --------------------------- 7. mouse resize (left / top / corner) + drag move
    await scenario("widget-mouse-resize-left-top-corner", async () => {
        await ev(`window.dash.setEditing(true); window.dash.addWidget("clock",{x:4,y:2,w:4,h:4},false); await new Promise(r=>setTimeout(r,400)); const els=document.querySelectorAll(".grid-stack-item"); els[els.length-1].id="j-rz"; els[els.length-1].classList.remove("ui-resizable-autohide"); return true;`);
        await delay(300);
        const geo = () => ev(`const el=document.getElementById("j-rz");return {x:+el.getAttribute("gs-x")||0,y:+el.getAttribute("gs-y")||0,w:+el.getAttribute("gs-w")||1,h:+el.getAttribute("gs-h")||1};`);
        const handle = (dir) => ev(`const el=document.getElementById("j-rz");el.classList.remove("ui-resizable-autohide");el.style.zIndex=500;const h=el.querySelector(".ui-resizable-${dir}");if(!h)return null;const r=h.getBoundingClientRect();const px=r.x+r.width/2,py=r.y+r.height/2;const top=document.elementFromPoint(px,py);return {x:px,y:py,w:r.width,h:r.height,onTarget:!!(top&&(top===h||el.contains(top))),topEl:top?top.className.toString().slice(0,60):"none"};`);
        const cell = await ev(`const g=document.querySelector(".grid-stack").getBoundingClientRect();const el=document.getElementById("j-rz");return {w:g.width/window.dash.grid.getColumn(),h:el.getBoundingClientRect().height/(+el.getAttribute("gs-h")||1)};`);
        const g0 = await geo();
        if (g0.w !== 4 || g0.h !== 4) throw new Error("test widget not parked 4x4: " + JSON.stringify(g0));
        // SE corner first (fresh widget): drag one cell right+down -> w+1, h+1
        let p = await handle("se");
        if (!p || !p.onTarget) throw new Error("se handle not hittable: " + JSON.stringify(p));
        await drag(p.x, p.y, p.x + cell.w, p.y + cell.h);
        const gSE = await geo();
        if (gSE.w !== g0.w + 1 || gSE.h !== g0.h + 1) throw new Error(`se corner drag: w ${g0.w}->${gSE.w} h ${g0.h}->${gSE.h} (handle ${JSON.stringify(p)})`);
        // LEFT edge: drag one cell left -> x-1, w+1
        p = await handle("w");
        if (!p || !p.onTarget) throw new Error("w handle not hittable: " + JSON.stringify(p));
        await drag(p.x, p.y, p.x - cell.w, p.y);
        const gW = await geo();
        if (gW.x !== gSE.x - 1 || gW.w !== gSE.w + 1) throw new Error(`west drag: x ${gSE.x}->${gW.x} w ${gSE.w}->${gW.w} (handle ${JSON.stringify(p)})`);
        // TOP edge: drag one cell down -> h-1 (float:false recompacts y, assert h)
        p = await handle("n");
        if (!p || !p.onTarget) throw new Error("n handle not hittable: " + JSON.stringify(p));
        await drag(p.x, p.y, p.x, p.y + cell.h);
        const gN = await geo();
        if (gN.h !== gSE.h - 1) throw new Error(`north drag: h ${gSE.h}->${gN.h} (handle ${JSON.stringify(p)})`);
        return `se w${g0.w}->${gSE.w} h${g0.h}->${gSE.h}; west x${gSE.x}->${gW.x} w${gSE.w}->${gW.w}; north h${gSE.h}->${gN.h}`;
    });
    await scenario("widget-drag-move-by-header", async () => {
        const g0 = await ev(`const el=document.getElementById("j-rz");return {x:+el.getAttribute("gs-x")||0,y:+el.getAttribute("gs-y")||0,w:+el.getAttribute("gs-w")||1};`);
        const cellW = await ev(`return document.querySelector(".grid-stack").getBoundingClientRect().width/window.dash.grid.getColumn();`);
        const hd = await ev(`const r=document.querySelector("#j-rz .widget > header").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};`);
        const dir = g0.x >= 2 ? -1 : 1; // move 2 cells toward free space
        await drag(hd.x, hd.y, hd.x + dir * 2 * cellW, hd.y);
        const g1 = await ev(`const el=document.getElementById("j-rz");return {x:+el.getAttribute("gs-x")||0,y:+el.getAttribute("gs-y")||0};`);
        if (g1.x === g0.x) throw new Error(`header drag did not move widget: x stays ${g0.x} (y ${g0.y}->${g1.y})`);
        if (Math.abs(g1.x - (g0.x + dir * 2)) > 1) throw new Error(`header drag landed off-target: x ${g0.x}->${g1.x}, wanted ~${g0.x + dir * 2}`);
        return `moved by header x ${g0.x}->${g1.x} (2 cells ${dir > 0 ? "right" : "left"})`;
    });
    await scenario("widget-close", async () => {
        const before = await ev(`return document.querySelectorAll(".grid-stack .widget").length;`);
        const ok = await ev(`let el=null;window.dash.mounted.forEach((rec,item)=>{if(rec.widgetId==="db")el=item;});if(!el)return false;window.dash.removeItem(el);return true;`);
        if (!ok) throw new Error("db widget not found to close");
        await delay(400);
        const after = await ev(`return document.querySelectorAll(".grid-stack .widget").length;`);
        await ev(`window.dash.setEditing(false); return true;`);
        if (after !== before - 1) throw new Error(`close: count ${before}->${after}`);
        return `closed db widget, ${before}->${after}`;
    });
    await shot("03-widgets");

    // ------------------------------------------------------------- 8. themes
    await scenario("theme-switch-3", async () => {
        const seen = [];
        for (const th of ["nebula", "voltage", "mono"]) {
            await ev(`window.ThemeEngine.apply(${JSON.stringify(th)}); return true;`);
            await delay(300);
            const v = await ev(`const cs=getComputedStyle(document.documentElement);return {cur:window.ThemeEngine.current,accent:cs.getPropertyValue("--accent").trim(),bg:cs.getPropertyValue("--bg-deep").trim()||cs.getPropertyValue("--bg").trim()};`);
            if (v.cur !== th || !v.accent) throw new Error(`apply(${th}) -> ${JSON.stringify(v)}`);
            seen.push(v);
        }
        const accents = new Set(seen.map(s => s.accent));
        if (accents.size < 3) throw new Error("accents did not all change: " + JSON.stringify(seen));
        return seen.map((s, i) => `${["nebula", "voltage", "mono"][i]}=${s.accent}`).join(" ");
    });
    await shot("04-theme-mono");

    // --------------------------------------------------------------- 9. i18n
    await scenario("i18n-en-ru-en", async () => {
        const en = await ev(`return {lang:window.I18N.lang,title:(document.querySelector('.grid-stack .widget header .title[data-i18n]')||{}).textContent,cat:(document.querySelector('#catalog-overlay h2[data-i18n="catalog.title"]')||{}).textContent,ph:document.querySelector("#catalog-search").placeholder};`);
        if (en.lang !== "en") throw new Error("start lang not en: " + en.lang);
        await ev(`window.I18N.set("ru"); return true;`); await delay(400);
        const ru = await ev(`return {title:(document.querySelector('.grid-stack .widget header .title[data-i18n]')||{}).textContent,cat:(document.querySelector('#catalog-overlay h2[data-i18n="catalog.title"]')||{}).textContent,ph:document.querySelector("#catalog-search").placeholder,cpu:(document.querySelector('[data-i18n="sysmon.cpu"]')||{}).textContent};`);
        const cyr = s => /[А-Яа-яЁё]/.test(s || "");
        if (!cyr(ru.title) && !cyr(ru.cpu)) throw new Error(`widget titles not russian: ${JSON.stringify(ru)}`);
        if (!cyr(ru.cat) && !cyr(ru.ph)) throw new Error(`catalog not russian: cat=${ru.cat} ph=${ru.ph}`);
        await ev(`window.I18N.set("en"); return true;`); await delay(400);
        const back = await ev(`return {lang:window.I18N.lang,title:(document.querySelector('.grid-stack .widget header .title[data-i18n]')||{}).textContent,cat:(document.querySelector('#catalog-overlay h2[data-i18n="catalog.title"]')||{}).textContent};`);
        if (back.lang !== "en" || back.title !== en.title || back.cat !== en.cat) throw new Error(`en restore mismatch: ${JSON.stringify(back)} vs ${JSON.stringify(en)}`);
        return `en "${en.title}"/"${en.cat}" -> ru "${ru.title}"/"${ru.cat}" (cpu "${ru.cpu}") -> en restored`;
    });

    // ------------------------------------------------------------ 10. density
    await scenario("density-compact-spacious", async () => {
        const cellH = () => ev(`return typeof window.dash.grid.getCellHeight==="function"?window.dash.grid.getCellHeight():window.dash.grid.opts.cellHeight;`);
        await ev(`window.dash.setDensity("compact"); return true;`); await delay(400);
        const c = { cls: await ev(`return document.body.classList.contains("density-compact");`), h: await cellH() };
        await ev(`window.dash.setDensity("spacious"); return true;`); await delay(400);
        const s = { cls: await ev(`return document.body.classList.contains("density-spacious");`), h: await cellH() };
        await ev(`window.dash.setDensity("comfortable"); return true;`); await delay(400);
        const m = { cls: await ev(`return document.body.classList.contains("density-comfortable");`), h: await cellH() };
        if (!c.cls || c.h !== 56) throw new Error("compact: " + JSON.stringify(c));
        if (!s.cls || s.h !== 88) throw new Error("spacious: " + JSON.stringify(s));
        if (!m.cls || m.h !== 70) throw new Error("comfortable restore: " + JSON.stringify(m));
        return `cellHeight compact=${c.h} spacious=${s.h} comfortable=${m.h}`;
    });

    // ------------------------------------------------------------ 11. dock 4 sides
    await scenario("dock-all-4-sides", async () => {
        const results = [];
        for (const side of ["left", "top", "bottom", "right"]) {
            await ev(`window.__setDock(${JSON.stringify(side)}); return true;`);
            await delay(500);
            const r = await ev(`const d=document.getElementById("dash-col").getBoundingClientRect();const t=document.getElementById("terminal-col").getBoundingClientRect();return {cls:document.body.classList.contains("dock-${side}"),d:{x:Math.round(d.x),y:Math.round(d.y),w:Math.round(d.width),h:Math.round(d.height)},t:{x:Math.round(t.x),y:Math.round(t.y)}};`);
            if (!r.cls) throw new Error(`body missing dock-${side}`);
            if (r.d.w < 40 || r.d.h < 40) throw new Error(`dash collapsed at dock-${side}: ${JSON.stringify(r.d)}`);
            const okGeom = side === "left" ? r.d.x < r.t.x : side === "right" ? r.d.x > r.t.x : side === "top" ? r.d.y < r.t.y : r.d.y > r.t.y;
            if (!okGeom) throw new Error(`dock-${side} geometry wrong: dash ${JSON.stringify(r.d)} vs term ${JSON.stringify(r.t)}`);
            results.push(`${side} ok(dash ${r.d.w}x${r.d.h})`);
        }
        return results.join(", ");
    });

    // ------------------------------------- 12. window sizes incl. 5120 ultrawide
    let boundsMethod = "emulation";
    const setViewport = async (w, h) => {
        await cdp("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
        await delay(900); // ResizeObserver debounce (120ms) + reflow + column CSS
    };
    // investigate Browser.setWindowBounds first (keep the window off-screen!)
    try {
        const winInfo = await cdp("Browser.getWindowForTarget", {});
        if (winInfo && winInfo.windowId != null) {
            await cdp("Browser.setWindowBounds", { windowId: winInfo.windowId, bounds: { width: 1512, height: 982 } });
            await delay(600);
            const iw = await ev(`return window.innerWidth;`);
            if (Math.abs(iw - 1512) <= 30) boundsMethod = "setWindowBounds";
        }
    } catch (e) { report.notes.push("Browser.setWindowBounds unavailable (" + e.message + "), using Emulation.setDeviceMetricsOverride"); }
    const setSize = async (w, h) => {
        if (boundsMethod === "setWindowBounds") {
            const winInfo = await cdp("Browser.getWindowForTarget", {});
            await cdp("Browser.setWindowBounds", { windowId: winInfo.windowId, bounds: { width: w, height: h } });
            await delay(900);
            const iw = await ev(`return window.innerWidth;`);
            if (Math.abs(iw - w) > 40) { boundsMethod = "emulation"; await setViewport(w, h); }
        } else await setViewport(w, h);
    };
    const measure = () => ev(`
        const dash=document.getElementById("dash-col").getBoundingClientRect();
        const grid=document.querySelector(".grid-stack").getBoundingClientRect();
        let right=0, n=0;
        document.querySelectorAll(".grid-stack-item").forEach(el=>{const r=el.getBoundingClientRect();n++;if(r.right>right)right=r.right;});
        return {inner:window.innerWidth,innerH:window.innerHeight,dashW:Math.round(dash.width),gridW:Math.round(grid.width),gridRight:Math.round(grid.right),rightmost:Math.round(right),deadPx:Math.round(grid.right-right),cols:window.dash.grid.getColumn(),widgets:n};
    `);
    await scenario("window-1512x982", async () => {
        await setSize(1512, 982);
        const m = await measure();
        if (Math.abs(m.inner - 1512) > 40) throw new Error("viewport not applied: " + JSON.stringify(m));
        if (m.cols < 12) throw new Error("cols<12: " + JSON.stringify(m));
        return `[${boundsMethod}] ` + JSON.stringify(m);
    });
    await scenario("window-2560x1440", async () => {
        await setSize(2560, 1440);
        const m = await measure();
        if (Math.abs(m.inner - 2560) > 40) throw new Error("viewport not applied: " + JSON.stringify(m));
        return `[${boundsMethod}] ` + JSON.stringify(m);
    });
    await scenario("window-5120x1440-ultrawide-fill", async () => {
        await setSize(5120, 1440);
        const m = await measure();
        report.ultrawide = m;
        if (Math.abs(m.inner - 5120) > 40) throw new Error("viewport not applied: " + JSON.stringify(m));
        await shot("05-ultrawide-5120");
        // the widget grid should fill the dash column: no huge dead region on the right
        const deadFrac = m.deadPx / m.gridW;
        if (deadFrac > 0.25) throw new Error(`dead region right of widgets: ${m.deadPx}px of ${m.gridW}px grid (${Math.round(deadFrac * 100)}%), dashW=${m.dashW}, cols=${m.cols}, rightmost widget edge=${m.rightmost}, gridRight=${m.gridRight}`);
        return `dashW=${m.dashW} gridW=${m.gridW} rightmost=${m.rightmost} dead=${m.deadPx}px (${Math.round(deadFrac * 100)}%) cols=${m.cols}`;
    });
    await cdp("Emulation.clearDeviceMetricsOverride").catch(() => {});
    await delay(600);

    // ------------------------------------------------------------- 13. clean quit
    await scenario("quit-clean-exit-0", async () => {
        try { await ev(`window.dyo.win("close"); return true;`); } catch (e) {}
        const t0 = Date.now();
        while (!exitInfo && Date.now() - t0 < 15000) await delay(300);
        if (!exitInfo) throw new Error("app did not exit within 15s of win close");
        if (exitInfo.code !== 0) throw new Error(`exit code ${exitInfo.code} signal ${exitInfo.signal}`);
        return `exited code 0 in ${((Date.now() - t0) / 1000).toFixed(1)}s`;
    });

    report.ok = report.scenarios.every(s => s.ok);
} catch (e) {
    report.fatal = String(e.stack || e);
    report.ok = false;
    console.log("FATAL", report.fatal.slice(0, 400));
} finally {
    if (!exitInfo) { try { app.kill("SIGKILL"); } catch (e) {} try { execSync(`pkill -9 -f \"remote-debugging-port=${PORT}"`); } catch (e) {} }
    await delay(500);
    if (report.consoleErrors.length) console.log("CONSOLE-ERRORS", JSON.stringify(report.consoleErrors.slice(0, 10)));
    if (report.exceptions.length) console.log("EXCEPTIONS", JSON.stringify(report.exceptions.slice(0, 10)));
    report.mainLog = mainLog.split("\n").slice(-30).join("\n");
    fs.writeFileSync(path.join(outDir, "e2e-journey-report.json"), JSON.stringify(report, null, 2));
    console.log(report.ok ? "ALL PASS" : "FAILURES");
    process.exit(report.ok ? 0 : 1);
}
