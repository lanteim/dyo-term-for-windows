"use strict";
window.I18N.register({
    en: { "widget.extra_unit": "Unit Converter", "cat.tools": "Tools" },
    ru: { "widget.extra_unit": "Конвертер единиц", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.extra_unit = {
    id: "extra_unit",
    title: "widget.extra_unit",
    category: "tools",
    description: "Length / mass / temperature / data-size converter",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        // Each category maps unit -> factor to a base unit (linear). Temp handled specially.
        const CATS = {
            length: { base: "m", units: { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 } },
            mass: { base: "kg", units: { mg: 1e-6, g: 0.001, kg: 1, t: 1000, oz: 0.0283495, lb: 0.453592, st: 6.35029 } },
            temp: { base: "C", units: { C: 1, F: 1, K: 1 } },
            data: { base: "B", units: { b: 0.125, B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776 } }
        };
        let cat = "length";

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                <select class="_cat"></select>
                <span style="color:var(--text-dim)">category</span>
              </div>
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                <input class="_in" value="1" style="width:110px"/>
                <select class="_from" style="width:80px"></select>
                <span style="color:var(--text-dim)">→</span>
                <select class="_to" style="width:80px"></select>
              </div>
              <div class="_out" style="font-size:24px;font-weight:500;color:var(--accent2);font-variant-numeric:tabular-nums;padding:6px 0">—</div>
              <div class="_all" style="flex:1;overflow:auto;font-variant-numeric:tabular-nums"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        ["._cat", "._in", "._from", "._to"].forEach(s => { $(s).style.cssText += ";background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono)"; });

        $("._cat").innerHTML = Object.keys(CATS).map(c => `<option value="${c}">${c}</option>`).join("");

        const toBase = (v, u) => {
            if (cat === "temp") { if (u === "C") return v; if (u === "F") return (v - 32) * 5 / 9; return v - 273.15; }
            return v * CATS[cat].units[u];
        };
        const fromBase = (c, u) => {
            if (cat === "temp") { if (u === "C") return c; if (u === "F") return c * 9 / 5 + 32; return c + 273.15; }
            return c / CATS[cat].units[u];
        };
        const num = x => { const n = Math.abs(x); if (n !== 0 && (n < 1e-4 || n >= 1e12)) return x.toExponential(4); return Number(x.toFixed(6)).toString(); };

        const fillUnits = () => {
            const opts = Object.keys(CATS[cat].units).map(u => `<option value="${u}">${u}</option>`).join("");
            $("._from").innerHTML = opts; $("._to").innerHTML = opts;
            const keys = Object.keys(CATS[cat].units);
            $("._from").value = keys[0]; $("._to").value = keys[Math.min(1, keys.length - 1)];
        };
        const calc = () => {
            const raw = parseFloat($("._in").value);
            if (isNaN(raw)) { $("._out").textContent = "enter a number"; $("._all").innerHTML = ""; return; }
            const base = toBase(raw, $("._from").value);
            $("._out").textContent = num(fromBase(base, $("._to").value)) + " " + $("._to").value;
            $("._all").innerHTML = Object.keys(CATS[cat].units).map(u =>
                `<div class="metric-row"><span class="k">${u}</span><span class="v">${num(fromBase(base, u))}</span></div>`
            ).join("");
        };
        fillUnits(); calc();
        $("._cat").onchange = () => { cat = $("._cat").value; fillUnits(); calc(); };
        ["._in", "._from", "._to"].forEach(s => { $(s).oninput = calc; $(s).onchange = calc; });

        return { destroy: () => {} };
    }
};
