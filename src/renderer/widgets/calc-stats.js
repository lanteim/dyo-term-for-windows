"use strict";
window.I18N.register({
    en: { "widget.calc_stats": "Quick Stats", "cat.tools": "Tools" },
    ru: { "widget.calc_stats": "Статистика", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.calc_stats = {
    id: "calc_stats",
    title: "widget.calc_stats",
    category: "tools",
    description: "Paste numbers, get count/sum/mean/median/min/max/stddev",
    defaultSize: { w: 7, h: 7 },
    mount(body) {
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono);font-size:13px";
        const fmt = n => {
            if (!isFinite(n)) return "—";
            const r = Math.round(n * 1e6) / 1e6;
            return String(r);
        };
        body.innerHTML = `
            <div style="display:flex;gap:10px;height:100%">
                <textarea class="s-in" spellcheck="false" style="${inp};flex:1;resize:none" placeholder="paste numbers…&#10;space, comma or newline separated"></textarea>
                <div style="flex:1;display:flex;flex-direction:column;gap:5px;font-size:13px"></div>
            </div>`;
        const ta = body.querySelector(".s-in");
        const out = body.querySelector("div > div");
        ta.value = "4 8 15 16 23 42";
        const rows = [
            ["count", "count"], ["sum", "sum"], ["mean", "mean"], ["median", "median"],
            ["min", "min"], ["max", "max"], ["range", "range"], ["stddev (pop)", "sd"], ["stddev (sample)", "sds"]
        ];
        out.innerHTML = rows.map(([label, key]) =>
            `<div style="display:flex;justify-content:space-between;gap:8px">
                <span style="color:var(--text-dim)">${label}</span>
                <b class="s-${key}" data-copy="—" style="cursor:pointer;font-family:var(--font-mono)" title="copy">—</b>
            </div>`).join("");
        const cells = {};
        rows.forEach(([, key]) => cells[key] = out.querySelector(".s-" + key));
        Object.values(cells).forEach(c => c.onclick = () => { const v = c.getAttribute("data-copy"); if (v !== "—") navigator.clipboard.writeText(v); });
        const set = (key, v) => { cells[key].textContent = v; cells[key].setAttribute("data-copy", v); };
        const calc = () => {
            const nums = ta.value.split(/[\s,;]+/).filter(s => s.length).map(Number).filter(n => Number.isFinite(n));
            if (nums.length === 0) { rows.forEach(([, k]) => set(k, "—")); return; }
            const n = nums.length;
            const sum = nums.reduce((a, b) => a + b, 0);
            const mean = sum / n;
            const sorted = nums.slice().sort((a, b) => a - b);
            const mid = Math.floor(n / 2);
            const median = n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
            const min = sorted[0], max = sorted[n - 1];
            const varPop = nums.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n;
            const varSamp = n > 1 ? nums.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1) : NaN;
            set("count", String(n));
            set("sum", fmt(sum));
            set("mean", fmt(mean));
            set("median", fmt(median));
            set("min", fmt(min));
            set("max", fmt(max));
            set("range", fmt(max - min));
            set("sd", fmt(Math.sqrt(varPop)));
            set("sds", n > 1 ? fmt(Math.sqrt(varSamp)) : "—");
        };
        ta.oninput = calc;
        calc();
        return { destroy() { ta.oninput = null; Object.values(cells).forEach(c => c.onclick = null); } };
    }
};
