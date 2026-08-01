"use strict";
window.I18N.register({
    en: { "widget.calc_gcdlcm": "GCD & LCM", "cat.tools": "Tools" },
    ru: { "widget.calc_gcdlcm": "НОД и НОК", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.calc_gcdlcm = {
    id: "calc_gcdlcm",
    title: "widget.calc_gcdlcm",
    category: "tools",
    description: "GCD and LCM of a list of integers",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono);width:100%;box-sizing:border-box;font-size:14px";
        const gcd2 = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; };
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:12px;font-size:13px;padding:2px">
                <div>
                    <span style="color:var(--text-dim)">Integers (space / comma / newline separated)</span>
                    <input class="g-in" style="${inp};margin-top:4px" value="24 36 60" placeholder="24 36 60">
                </div>
                <div style="display:flex;flex-direction:column;gap:6px">
                    <div style="display:flex;justify-content:space-between;font-size:15px"><span style="color:var(--text-dim)">GCD</span><b class="g-gcd" style="color:var(--accent);cursor:pointer" title="copy">—</b></div>
                    <div style="display:flex;justify-content:space-between;font-size:15px"><span style="color:var(--text-dim)">LCM</span><b class="g-lcm" style="color:var(--accent);cursor:pointer" title="copy">—</b></div>
                    <div class="g-note" style="color:var(--text-dim);font-size:12px"></div>
                </div>
            </div>`;
        const q = c => body.querySelector(c);
        const el = q(".g-in"), og = q(".g-gcd"), ol = q(".g-lcm"), note = q(".g-note");
        const setCopy = (node, txt) => { node.textContent = txt; node.onclick = () => { if (txt !== "—") navigator.clipboard.writeText(txt); }; };
        const calc = () => {
            const parts = el.value.split(/[\s,]+/).filter(s => s.length);
            const nums = [];
            let bad = false;
            for (const p of parts) {
                const n = Number(p);
                if (!Number.isFinite(n) || !Number.isInteger(n)) { bad = true; continue; }
                nums.push(n);
            }
            if (nums.length === 0) { setCopy(og, "—"); setCopy(ol, "—"); note.textContent = bad ? "no valid integers" : ""; return; }
            let g = Math.abs(nums[0]);
            for (let i = 1; i < nums.length; i++) g = gcd2(g, nums[i]);
            setCopy(og, String(g));
            let hasZero = nums.some(n => n === 0);
            if (hasZero) { setCopy(ol, "0"); }
            else {
                let l = Math.abs(nums[0]);
                let overflow = false;
                for (let i = 1; i < nums.length; i++) {
                    l = Math.abs(l / gcd2(l, nums[i]) * nums[i]);
                    if (l > Number.MAX_SAFE_INTEGER) { overflow = true; break; }
                }
                setCopy(ol, overflow ? "too large" : String(l));
            }
            note.textContent = (bad ? "some tokens ignored · " : "") + nums.length + " number" + (nums.length === 1 ? "" : "s");
        };
        el.oninput = calc;
        calc();
        return { destroy() { el.oninput = null; og.onclick = null; ol.onclick = null; } };
    }
};
