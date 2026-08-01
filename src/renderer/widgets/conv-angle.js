"use strict";
window.I18N.register({
    en: { "widget.conv_angle": "Angle Converter", "cat.tools": "Tools" },
    ru: { "widget.conv_angle": "Конвертер углов", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.conv_angle = {
    id: "conv_angle",
    title: "widget.conv_angle",
    category: "tools",
    description: "Live degrees / radians / gradians conversion",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:12px;width:100%;box-sizing:border-box";
        const lbl = "color:var(--text-dim);font-size:11px;margin-bottom:2px";
        const copyBtn = "background:var(--bg-elevated);color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:4px 8px;cursor:pointer;font-family:var(--font-mono);font-size:11px";

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:10px;height:100%;overflow:auto;font-family:var(--font-mono)">
            <div><div style="${lbl}">Degrees (°)</div><div style="display:flex;gap:6px"><input class="_deg" spellcheck="false" style="${inp}"><button data-k="_deg" class="_cp" style="${copyBtn}">copy</button></div></div>
            <div><div style="${lbl}">Radians (rad)</div><div style="display:flex;gap:6px"><input class="_rad" spellcheck="false" style="${inp}"><button data-k="_rad" class="_cp" style="${copyBtn}">copy</button></div></div>
            <div><div style="${lbl}">Gradians (grad)</div><div style="display:flex;gap:6px"><input class="_grad" spellcheck="false" style="${inp}"><button data-k="_grad" class="_cp" style="${copyBtn}">copy</button></div></div>
            <div class="_msg" style="${lbl};margin-top:auto"></div>
          </div>`;
        const $ = s => body.querySelector(s);
        const deg = $("._deg"), rad = $("._rad"), grad = $("._grad"), msg = $("._msg");
        const round = n => { const r = Math.round(n * 1e9) / 1e9; return Object.is(r, -0) ? 0 : r; };

        // work in degrees internally
        const update = (from, degrees) => {
            if (!isFinite(degrees)) { msg.textContent = "invalid"; return; }
            if (from !== "deg") deg.value = round(degrees);
            if (from !== "rad") rad.value = round(degrees * Math.PI / 180);
            if (from !== "grad") grad.value = round(degrees * 10 / 9);
            msg.textContent = "";
        };
        const guard = (raw, toDeg) => { const t = raw.trim(); if (t === "") { deg.value = rad.value = grad.value = ""; msg.textContent = ""; return null; } const n = Number(t); if (!isFinite(n)) { msg.textContent = "invalid number"; return null; } return toDeg(n); };
        deg.addEventListener("input", () => { const v = guard(deg.value, n => n); if (v !== null) update("deg", v); });
        rad.addEventListener("input", () => { const v = guard(rad.value, n => n * 180 / Math.PI); if (v !== null) update("rad", v); });
        grad.addEventListener("input", () => { const v = guard(grad.value, n => n * 9 / 10); if (v !== null) update("grad", v); });
        body.querySelectorAll("._cp").forEach(b => b.onclick = () => { const v = $(b.dataset.k).value; if (v) navigator.clipboard.writeText(v).catch(() => {}); });
        deg.value = "90"; update("deg", 90);

        return { destroy() {} };
    }
};
