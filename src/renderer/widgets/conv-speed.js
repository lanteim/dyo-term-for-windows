"use strict";
window.I18N.register({
    en: { "widget.conv_speed": "Speed Converter", "cat.tools": "Tools" },
    ru: { "widget.conv_speed": "Конвертер скорости", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.conv_speed = {
    id: "conv_speed",
    title: "widget.conv_speed",
    category: "tools",
    description: "Live m/s / km/h / mph / knots conversion",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:12px;width:100%;box-sizing:border-box";
        const lbl = "color:var(--text-dim);font-size:11px;margin-bottom:2px";
        const copyBtn = "background:var(--bg-elevated);color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:4px 8px;cursor:pointer;font-family:var(--font-mono);font-size:11px";

        // key: [label, metersPerSecond per unit]
        const units = [["ms", "m/s", 1], ["kmh", "km/h", 1 / 3.6], ["mph", "mph", 0.44704], ["knot", "knots", 0.514444]];
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:10px;height:100%;overflow:auto;font-family:var(--font-mono)">
            ${units.map(([k, t]) => `<div><div style="${lbl}">${t}</div><div style="display:flex;gap:6px"><input class="_${k}" spellcheck="false" style="${inp}"><button data-k="_${k}" class="_cp" style="${copyBtn}">copy</button></div></div>`).join("")}
            <div class="_msg" style="${lbl};margin-top:auto"></div>
          </div>`;
        const $ = s => body.querySelector(s);
        const els = {}; units.forEach(([k]) => els[k] = $("._" + k));
        const msg = $("._msg");
        const round = n => { const r = Math.round(n * 1e6) / 1e6; return Object.is(r, -0) ? 0 : r; };

        const update = from => {
            const raw = els[from].value.trim();
            if (raw === "") { units.forEach(([k]) => { if (k !== from) els[k].value = ""; }); msg.textContent = ""; return; }
            const n = Number(raw);
            if (!isFinite(n)) { msg.textContent = "invalid number"; return; }
            const factor = units.find(u => u[0] === from)[2];
            const mps = n * factor;
            units.forEach(([k, , f]) => { if (k !== from) els[k].value = round(mps / f); });
            msg.textContent = "";
        };
        units.forEach(([k]) => els[k].addEventListener("input", () => update(k)));
        body.querySelectorAll("._cp").forEach(b => b.onclick = () => { const v = $(b.dataset.k).value; if (v) navigator.clipboard.writeText(v).catch(() => {}); });
        els.kmh.value = "100"; update("kmh");

        return { destroy() {} };
    }
};
