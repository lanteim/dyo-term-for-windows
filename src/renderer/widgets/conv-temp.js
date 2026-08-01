"use strict";
window.I18N.register({
    en: { "widget.conv_temp": "Temperature Converter", "cat.tools": "Tools" },
    ru: { "widget.conv_temp": "Конвертер температуры", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.conv_temp = {
    id: "conv_temp",
    title: "widget.conv_temp",
    category: "tools",
    description: "Live Celsius / Fahrenheit / Kelvin conversion",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:12px;width:100%;box-sizing:border-box";
        const lbl = "color:var(--text-dim);font-size:11px;margin-bottom:2px";
        const copyBtn = "background:var(--bg-elevated);color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:4px 8px;cursor:pointer;font-family:var(--font-mono);font-size:11px";

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:10px;height:100%;overflow:auto;font-family:var(--font-mono)">
            <div><div style="${lbl}">Celsius (°C)</div><div style="display:flex;gap:6px"><input class="_c" spellcheck="false" style="${inp}"><button data-k="_c" class="_cp" style="${copyBtn}">copy</button></div></div>
            <div><div style="${lbl}">Fahrenheit (°F)</div><div style="display:flex;gap:6px"><input class="_f" spellcheck="false" style="${inp}"><button data-k="_f" class="_cp" style="${copyBtn}">copy</button></div></div>
            <div><div style="${lbl}">Kelvin (K)</div><div style="display:flex;gap:6px"><input class="_k" spellcheck="false" style="${inp}"><button data-k="_k" class="_cp" style="${copyBtn}">copy</button></div></div>
            <div class="_msg" style="${lbl};margin-top:auto"></div>
          </div>`;
        const $ = s => body.querySelector(s);
        const c = $("._c"), f = $("._f"), k = $("._k"), msg = $("._msg");
        const round = n => { const r = Math.round(n * 1e6) / 1e6; return Object.is(r, -0) ? 0 : r; };

        const update = (from, celsius) => {
            if (!isFinite(celsius)) { msg.textContent = "invalid"; return; }
            if (from !== "c") c.value = round(celsius);
            if (from !== "f") f.value = round(celsius * 9 / 5 + 32);
            if (from !== "k") k.value = round(celsius + 273.15);
            msg.textContent = celsius < -273.15 ? "below absolute zero" : "";
        };
        const guard = (raw, fn) => { const t = raw.trim(); if (t === "") { c.value = f.value = k.value = ""; msg.textContent = ""; return null; } const n = Number(t); if (!isFinite(n)) { msg.textContent = "invalid number"; return null; } return fn(n); };
        c.addEventListener("input", () => { const v = guard(c.value, n => n); if (v !== null) update("c", v); });
        f.addEventListener("input", () => { const v = guard(f.value, n => (n - 32) * 5 / 9); if (v !== null) update("f", v); });
        k.addEventListener("input", () => { const v = guard(k.value, n => n - 273.15); if (v !== null) update("k", v); });
        body.querySelectorAll("._cp").forEach(b => b.onclick = () => { const v = $(b.dataset.k).value; if (v) navigator.clipboard.writeText(v).catch(() => {}); });
        c.value = "20"; update("c", 20);

        return { destroy() {} };
    }
};
