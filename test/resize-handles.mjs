// Verify widgets resize from ANY side/corner (gridstack default was se-only):
//   1. in edit mode every widget carries all 8 resize handles (n,e,s,w,ne,nw,se,sw),
//   2. a real mouse drag on the WEST handle grows the widget leftwards (x-1, w+1),
//   3. a real mouse drag on the NORTH handle shrinks it from the top (h-1).
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userData = path.join(appDir, ".smoke", "rz-ud");
fs.rmSync(userData, { recursive: true, force: true }); fs.mkdirSync(userData, { recursive: true });
const PORT = 9403;
const app = spawn(path.join(appDir, "node_modules", ".bin", "electron"), [".", `--remote-debugging-port=${PORT}`], {
    cwd: appDir, env: { ...process.env, DYOTERM_USER_DATA: userData, DYOTERM_BACKGROUND: "1", DYOTERM_NO_WEBGL: "1" }, stdio: ["ignore", "ignore", "ignore"]
});
const delay = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(); const errs = [];
const cdp = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); setTimeout(() => pend.has(i) && (pend.delete(i), rej(new Error("timeout " + m))), 20000); });
const ev = (e) => cdp("Runtime.evaluate", { expression: `(async()=>{${e}})()`, returnByValue: true, awaitPromise: true }).then(r => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; });
let pass = true;
const check = (name, cond, extra) => { console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  (" + extra + ")" : "")); if (!cond) pass = false; };
const drag = async (x0, y0, x1, y1) => {
    await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0, y: y0 });
    await delay(120); // let gridstack's autohide hover-in run
    await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: x0, y: y0, button: "left", buttons: 1, clickCount: 1 });
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
        await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0 + (x1 - x0) * i / steps, y: y0 + (y1 - y0) * i / steps, button: "left", buttons: 1 });
        await delay(30);
    }
    await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: x1, y: y1, button: "left", buttons: 1, clickCount: 1 });
    await delay(500); // resize commit + change event
};
try {
    let target = null;
    for (let i = 0; i < 50 && !target; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = l.find(t => t.type === "page" && (t.url || "").includes("index.html")); } catch (e) {} await delay(800); }
    ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    ws.on("message", raw => { const m = JSON.parse(raw); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } else if (m.method === "Runtime.exceptionThrown") errs.push((m.params.exceptionDetails?.exception?.description || "").slice(0, 160)); });
    await cdp("Runtime.enable"); await cdp("Page.enable");
    for (let i = 0; i < 60; i++) { if (await ev("return !!(window.dash && window.dash.grid)")) break; await delay(500); }

    // Edit mode on, park a 4x4 widget mid-grid (x=4 keeps both west and east free).
    await ev(`
        window.dash.setEditing(true);
        window.dash.addWidget("git", { x: 4, y: 2, w: 4, h: 4 }, false);
        await new Promise(r=>setTimeout(r,400));
        const els = document.querySelectorAll(".grid-stack-item");
        els[els.length - 1].id = "rz-test-item";
        return true;
    `);
    const geo0 = await ev(`const el=document.getElementById("rz-test-item"); return { x:+el.getAttribute("gs-x")||0, w:+el.getAttribute("gs-w")||1, h:+el.getAttribute("gs-h")||1 };`);
    check("test widget parked at x=4 w=4", geo0.x === 4 && geo0.w === 4, JSON.stringify(geo0));

    // 1) all 8 handles exist on the item in edit mode
    const dirs = await ev(`
        const el = document.getElementById("rz-test-item");
        return [...el.querySelectorAll(".ui-resizable-handle")]
            .map(h => [...h.classList].find(c => /^ui-resizable-(n|e|s|w|ne|nw|se|sw)$/.test(c)))
            .filter(Boolean).map(c => c.replace("ui-resizable-", "")).sort().join(",");
    `);
    check("all 8 resize handles present", dirs === "e,n,ne,nw,s,se,sw,w", dirs);

    // 2) WEST drag: one cell left → x 4→3, w 4→5 (impossible with se-only handles)
    const cellW = await ev(`return document.querySelector(".grid-stack").getBoundingClientRect().width / 12;`);
    const wr = await ev(`
        const el = document.getElementById("rz-test-item");
        el.classList.remove("ui-resizable-autohide"); // hover normally reveals handles; synthetic hover can race
        const r = el.querySelector(".ui-resizable-w").getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    `);
    await drag(wr.x, wr.y, wr.x - cellW, wr.y);
    const geoW = await ev(`const el=document.getElementById("rz-test-item"); return { x:+el.getAttribute("gs-x")||0, w:+el.getAttribute("gs-w")||1 };`);
    check("west drag grew widget leftwards (x-1, w+1)", geoW.x === geo0.x - 1 && geoW.w === geo0.w + 1, `x ${geo0.x}→${geoW.x}, w ${geo0.w}→${geoW.w}`);

    // 3) NORTH drag: one cell down → h-1 (float:false may recompact y, so assert h only)
    const cellH = await ev(`const el=document.getElementById("rz-test-item"); return el.getBoundingClientRect().height / (+el.getAttribute("gs-h")||1);`);
    const nr = await ev(`
        const el = document.getElementById("rz-test-item");
        el.classList.remove("ui-resizable-autohide");
        const r = el.querySelector(".ui-resizable-n").getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    `);
    await drag(nr.x, nr.y, nr.x, nr.y + cellH);
    const geoN = await ev(`const el=document.getElementById("rz-test-item"); return { h:+el.getAttribute("gs-h")||1 };`);
    check("north drag shrank widget from the top (h-1)", geoN.h === geo0.h - 1, `h ${geo0.h}→${geoN.h}`);

    try {
        const shot = await cdp("Page.captureScreenshot", { format: "png" });
        fs.writeFileSync(path.join(appDir, ".smoke", "resize.png"), Buffer.from(shot.data, "base64"));
    } catch (e) {}

    check("no uncaught console errors", errs.length === 0);
    if (errs.length) console.log("errors:", errs.slice(0, 6).join(" | "));
} catch (e) { console.error("resize-handles fatal:", e.message); pass = false; }
finally { try { await ev(`window.dyo.win("close")`); } catch (e) {} await delay(600); try { app.kill("SIGKILL"); } catch (e) {} console.log(pass ? "\nALL PASS" : "\nFAILED"); process.exit(pass ? 0 : 1); }
