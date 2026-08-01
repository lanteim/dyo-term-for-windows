// Focused probe for the widget-catalog UI: opens the catalog, exercises search,
// category chips and the A–Z toggle, and asserts the DOM reacts correctly.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(appDir, ".smoke");
const userData = path.join(outDir, "catalog-ud");
fs.rmSync(userData, { recursive: true, force: true });
fs.mkdirSync(userData, { recursive: true });
const PORT = 9367;

const app = spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", `--remote-debugging-port=${PORT}`], {
    cwd: appDir,
    env: { ...process.env, DYOTERM_USER_DATA: userData, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" },
    stdio: ["ignore", "ignore", "ignore"]
});

const delay = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map();
const cdp = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); setTimeout(() => pend.has(i) && (pend.delete(i), rej(new Error("timeout " + m))), 20000); });
const ev = (e, a = false) => cdp("Runtime.evaluate", { expression: `(async()=>{${e}})()`, returnByValue: true, awaitPromise: true }).then(r => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; });

const checks = [];
const assert = (name, cond, detail = "") => { checks.push({ name, ok: !!cond, detail }); };

try {
    let target = null;
    for (let i = 0; i < 50 && !target; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = l.find(t => t.type === "page" && (t.url || "").includes("index.html")); } catch (e) {} await delay(800); }
    if (!target) throw new Error("no page target");
    ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    ws.on("message", raw => { const m = JSON.parse(raw); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
    await cdp("Runtime.enable");
    for (let i = 0; i < 40; i++) { if (await ev("return !!(window.dash && window.WIDGETS)")) break; await delay(500); }

    const total = await ev("return Object.keys(window.WIDGETS).length");

    // 1. open catalog
    await ev("window.dash.openCatalog(); return true"); await delay(200);
    assert("catalog opens", await ev("return document.getElementById('catalog-overlay').classList.contains('open')"));

    // 2. chips rendered (All + every category)
    const chipCount = await ev("return document.querySelectorAll('#catalog-cats .cat-chip').length");
    const catCount = await ev("return new Set(Object.values(window.WIDGETS).map(w=>w.category||'other')).size");
    assert("category chips = cats + All", chipCount === catCount + 1, `chips=${chipCount} cats=${catCount}`);

    // 3. all cards visible by default
    const cardsAll = await ev("return document.querySelectorAll('#catalog-body .cat-item').length");
    assert("all widgets listed by default", cardsAll === total, `cards=${cardsAll} total=${total}`);
    assert("count label matches", (await ev("return document.getElementById('catalog-count').textContent")).startsWith(total + " / " + total));

    // 4. search narrows results
    await ev(`const s=document.getElementById('catalog-search'); s.value='clock'; s.dispatchEvent(new Event('input',{bubbles:true})); return true`); await delay(120);
    const searched = await ev("return document.querySelectorAll('#catalog-body .cat-item').length");
    assert("search narrows list", searched > 0 && searched < total, `matches=${searched}`);
    assert("search matches contain 'clock'", await ev("return [...document.querySelectorAll('#catalog-body .cat-item')].every(el=>{const id=el.dataset.id.toLowerCase();const txt=el.innerText.toLowerCase();return id.includes('clock')||txt.includes('clock')})"));

    // 5. clear search restores
    await ev(`const s=document.getElementById('catalog-search'); s.value=''; s.dispatchEvent(new Event('input',{bubbles:true})); return true`); await delay(120);
    assert("clearing search restores all", (await ev("return document.querySelectorAll('#catalog-body .cat-item').length")) === total);

    // 6. category chip filters
    const firstCat = await ev("return [...document.querySelectorAll('#catalog-cats .cat-chip')].find(c=>c.dataset.cat!=='all').dataset.cat");
    const expectInCat = await ev(`return Object.values(window.WIDGETS).filter(w=>(w.category||'other')===${JSON.stringify(firstCat)}).length`);
    await ev(`[...document.querySelectorAll('#catalog-cats .cat-chip')].find(c=>c.dataset.cat===${JSON.stringify(firstCat)}).click(); return true`); await delay(120);
    const inCat = await ev("return document.querySelectorAll('#catalog-body .cat-item').length");
    assert("category chip filters", inCat === expectInCat, `cat=${firstCat} shown=${inCat} expect=${expectInCat}`);
    assert("clicked chip becomes active", await ev(`return document.querySelector('#catalog-cats .cat-chip[data-cat=${JSON.stringify(firstCat)}]').classList.contains('active')`));

    // reset to All
    await ev("document.querySelector('#catalog-cats .cat-chip[data-cat=\"all\"]').click(); return true"); await delay(120);

    // 7. A–Z toggle renders letter headers + jump index
    await ev("document.getElementById('catalog-sort').click(); return true"); await delay(150);
    const heads = await ev("return document.querySelectorAll('#catalog-body .az-head').length");
    const jumps = await ev("return document.querySelectorAll('#catalog-az .az-jump').length");
    assert("A–Z shows letter headers", heads > 1, `heads=${heads}`);
    assert("A–Z jump index matches headers", heads === jumps, `heads=${heads} jumps=${jumps}`);
    assert("A–Z still lists all cards", (await ev("return document.querySelectorAll('#catalog-body .cat-item').length")) === total);

    // 8. toggle back to grouped
    await ev("document.getElementById('catalog-sort').click(); return true"); await delay(150);
    assert("toggle back to grouped (no az-head)", (await ev("return document.querySelectorAll('#catalog-body .az-head').length")) === 0);

    // 9. clicking a card adds a widget and closes catalog
    const before = await ev("return window.dash.mounted.size");
    await ev("document.querySelector('#catalog-body .cat-item').click(); return true"); await delay(300);
    assert("clicking card mounts a widget", (await ev("return window.dash.mounted.size")) === before + 1);
    assert("clicking card closes catalog", !(await ev("return document.getElementById('catalog-overlay').classList.contains('open')")));

    console.log(`\nCATALOG PROBE (total widgets: ${total})`);
    let allOk = true;
    for (const c of checks) { console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? "  (" + c.detail + ")" : ""}`); if (!c.ok) allOk = false; }
    console.log(allOk ? "\nALL CATALOG CHECKS PASSED" : "\nCATALOG CHECKS FAILED");
} catch (e) {
    console.error("catalog-probe fatal:", e.message);
} finally {
    try { await ev(`window.dyo.win("close")`); } catch (e) {}
    await delay(800); try { app.kill("SIGKILL"); } catch (e) {}
    process.exit(0);
}
