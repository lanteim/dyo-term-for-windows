"use strict";
window.I18N.register({
    en: { "widget.calc_percentage": "Percentage", "cat.tools": "Tools" },
    ru: { "widget.calc_percentage": "Проценты", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.calc_percentage = {
    id: "calc_percentage",
    title: "widget.calc_percentage",
    category: "tools",
    description: "X% of Y, X is what % of Y, and percent change",
    defaultSize: { w: 7, h: 6 },
    mount(body) {
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);width:90px";
        const fmt = n => {
            if (!isFinite(n)) return "—";
            const r = Math.round(n * 1e6) / 1e6;
            return String(r);
        };
        const num = el => { const v = parseFloat(el.value); return el.value.trim() === "" ? NaN : v; };
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:12px;font-size:13px;padding:2px">
                <div>
                    <div style="color:var(--text-dim);margin-bottom:4px">What is X% of Y?</div>
                    <input class="p-x" type="number" style="${inp}" placeholder="X" value="15">
                    <span style="color:var(--text-dim)">% of</span>
                    <input class="p-y" type="number" style="${inp}" placeholder="Y" value="200">
                    <span style="color:var(--text-dim)">=</span>
                    <b class="p-r1" style="color:var(--accent);cursor:pointer" title="copy">—</b>
                </div>
                <div>
                    <div style="color:var(--text-dim);margin-bottom:4px">X is what % of Y?</div>
                    <input class="p-a" type="number" style="${inp}" placeholder="X" value="30">
                    <span style="color:var(--text-dim)">of</span>
                    <input class="p-b" type="number" style="${inp}" placeholder="Y" value="150">
                    <span style="color:var(--text-dim)">=</span>
                    <b class="p-r2" style="color:var(--accent);cursor:pointer" title="copy">—</b>
                </div>
                <div>
                    <div style="color:var(--text-dim);margin-bottom:4px">% change from A to B</div>
                    <input class="p-from" type="number" style="${inp}" placeholder="from" value="80">
                    <span style="color:var(--text-dim)">→</span>
                    <input class="p-to" type="number" style="${inp}" placeholder="to" value="100">
                    <span style="color:var(--text-dim)">=</span>
                    <b class="p-r3" style="cursor:pointer" title="copy">—</b>
                </div>
            </div>`;
        const q = c => body.querySelector(c);
        const px = q(".p-x"), py = q(".p-y"), pa = q(".p-a"), pb = q(".p-b"), pf = q(".p-from"), pt = q(".p-to");
        const r1 = q(".p-r1"), r2 = q(".p-r2"), r3 = q(".p-r3");
        const setCopy = (el, txt) => { el.textContent = txt; el.onclick = () => { if (txt !== "—") navigator.clipboard.writeText(txt); }; };
        const calc = () => {
            const x = num(px), y = num(py);
            setCopy(r1, isNaN(x) || isNaN(y) ? "—" : fmt(x / 100 * y));
            const a = num(pa), b = num(pb);
            setCopy(r2, isNaN(a) || isNaN(b) || b === 0 ? "—" : fmt(a / b * 100) + "%");
            const f = num(pf), t = num(pt);
            let c3 = "—", col = "var(--text)";
            if (!isNaN(f) && !isNaN(t) && f !== 0) {
                const d = (t - f) / Math.abs(f) * 100;
                c3 = (d >= 0 ? "+" : "") + fmt(d) + "%";
                col = d > 0 ? "var(--accent)" : d < 0 ? "var(--danger)" : "var(--text)";
            }
            r3.style.color = col;
            setCopy(r3, c3);
        };
        const ins = [px, py, pa, pb, pf, pt];
        ins.forEach(el => el.oninput = calc);
        calc();
        return { destroy() { ins.forEach(el => { el.oninput = null; }); [r1, r2, r3].forEach(el => el.onclick = null); } };
    }
};
