"use strict";
window.I18N.register({
    en: { "widget.calc_ratio": "Ratio & Aspect", "cat.tools": "Tools" },
    ru: { "widget.calc_ratio": "Соотношение", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.calc_ratio = {
    id: "calc_ratio",
    title: "widget.calc_ratio",
    category: "tools",
    description: "Simplify a ratio and solve aspect-ratio dimensions",
    defaultSize: { w: 7, h: 6 },
    mount(body) {
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);width:90px";
        const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; };
        const num = el => { const v = parseFloat(el.value); return el.value.trim() === "" ? NaN : v; };
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:14px;font-size:13px;padding:2px">
                <div>
                    <div style="color:var(--text-dim);margin-bottom:4px">Simplify ratio A : B</div>
                    <input class="r-a" type="number" style="${inp}" placeholder="A" value="1920">
                    <span style="color:var(--text-dim)">:</span>
                    <input class="r-b" type="number" style="${inp}" placeholder="B" value="1080">
                    <span style="color:var(--text-dim)">=</span>
                    <b class="r-out" style="color:var(--accent);cursor:pointer" title="copy">—</b>
                </div>
                <div>
                    <div style="color:var(--text-dim);margin-bottom:4px">Aspect solver — fill three, get the fourth</div>
                    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                        <input class="a-w1" type="number" style="${inp}" placeholder="W" value="16">
                        <span style="color:var(--text-dim)">:</span>
                        <input class="a-h1" type="number" style="${inp}" placeholder="H" value="9">
                        <span style="color:var(--text-dim)">→</span>
                        <input class="a-w2" type="number" style="${inp}" placeholder="W2" value="1280">
                        <span style="color:var(--text-dim)">:</span>
                        <input class="a-h2" type="number" style="${inp}" placeholder="H2">
                    </div>
                    <div style="margin-top:6px;color:var(--text-dim)">missing = <b class="a-out" style="color:var(--accent);cursor:pointer" title="copy">—</b></div>
                </div>
            </div>`;
        const q = c => body.querySelector(c);
        const ra = q(".r-a"), rb = q(".r-b"), rout = q(".r-out");
        const w1 = q(".a-w1"), h1 = q(".a-h1"), w2 = q(".a-w2"), h2 = q(".a-h2"), aout = q(".a-out");
        const setCopy = (el, txt) => { el.textContent = txt; el.onclick = () => { if (txt !== "—") navigator.clipboard.writeText(txt); }; };
        const fmt = n => String(Math.round(n * 1e6) / 1e6);
        const calc = () => {
            const a = num(ra), b = num(rb);
            if (!isNaN(a) && !isNaN(b) && a !== 0 && b !== 0 && Number.isInteger(a) && Number.isInteger(b)) {
                const g = gcd(a, b);
                setCopy(rout, `${a / g} : ${b / g}`);
            } else if (!isNaN(a) && !isNaN(b) && b !== 0) {
                setCopy(rout, `${fmt(a / b)} : 1`);
            } else setCopy(rout, "—");
            const vw1 = num(w1), vh1 = num(h1), vw2 = num(w2), vh2 = num(h2);
            let disp = "—", copyVal = "—";
            if (!isNaN(vw1) && !isNaN(vh1) && vw1 !== 0 && vh1 !== 0) {
                if (!isNaN(vw2) && isNaN(vh2)) { copyVal = fmt(vw2 * vh1 / vw1); disp = "H2 = " + copyVal; }
                else if (isNaN(vw2) && !isNaN(vh2)) { copyVal = fmt(vh2 * vw1 / vh1); disp = "W2 = " + copyVal; }
                else if (!isNaN(vw2) && !isNaN(vh2)) disp = "both filled";
            }
            aout.textContent = disp;
            aout.onclick = () => { if (copyVal !== "—") navigator.clipboard.writeText(copyVal); };
        };
        const ins = [ra, rb, w1, h1, w2, h2];
        ins.forEach(el => el.oninput = calc);
        calc();
        return { destroy() { ins.forEach(el => { el.oninput = null; }); rout.onclick = null; aout.onclick = null; } };
    }
};
