"use strict";
window.I18N.register({
    en: { "widget.conv_roman": "Roman Numeral Converter", "cat.tools": "Tools" },
    ru: { "widget.conv_roman": "Конвертер римских чисел", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.conv_roman = {
    id: "conv_roman",
    title: "widget.conv_roman",
    category: "tools",
    description: "Live integer <-> Roman numeral (1..3999)",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:14px;width:100%;box-sizing:border-box";
        const lbl = "color:var(--text-dim);font-size:11px;margin-bottom:2px";
        const copyBtn = "background:var(--bg-elevated);color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:4px 8px;cursor:pointer;font-family:var(--font-mono);font-size:11px";

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:10px;height:100%;overflow:auto;font-family:var(--font-mono)">
            <div><div style="${lbl}">Integer (1 – 3999)</div><div style="display:flex;gap:6px"><input class="_n" spellcheck="false" style="${inp}" placeholder="2024"><button data-k="_n" class="_cp" style="${copyBtn}">copy</button></div></div>
            <div><div style="${lbl}">Roman</div><div style="display:flex;gap:6px"><input class="_r" spellcheck="false" style="${inp};letter-spacing:2px" placeholder="MMXXIV"><button data-k="_r" class="_cp" style="${copyBtn}">copy</button></div></div>
            <div class="_msg" style="${lbl};margin-top:auto"></div>
          </div>`;
        const $ = s => body.querySelector(s);
        const nEl = $("._n"), rEl = $("._r"), msg = $("._msg");
        const map = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
        const toRoman = num => { let out = ""; for (const [v, s] of map) { while (num >= v) { out += s; num -= v; } } return out; };
        const fromRoman = str => {
            const s = str.toUpperCase();
            if (!/^[MDCLXVI]+$/.test(s)) return null;
            let i = 0, total = 0;
            for (const [v, sym] of map) { while (s.startsWith(sym, i)) { total += v; i += sym.length; } }
            if (i !== s.length) return null;
            if (total < 1 || total > 3999 || toRoman(total) !== s) return null;
            return total;
        };
        nEl.addEventListener("input", () => {
            const raw = nEl.value.trim();
            if (raw === "") { rEl.value = ""; msg.textContent = ""; return; }
            if (!/^\d+$/.test(raw)) { msg.textContent = "digits only"; return; }
            const n = Number(raw);
            if (n < 1 || n > 3999) { rEl.value = ""; msg.textContent = "range is 1..3999"; return; }
            rEl.value = toRoman(n); msg.textContent = "";
        });
        rEl.addEventListener("input", () => {
            const raw = rEl.value.trim();
            if (raw === "") { nEl.value = ""; msg.textContent = ""; return; }
            const n = fromRoman(raw);
            if (n === null) { msg.textContent = "invalid roman numeral"; return; }
            nEl.value = String(n); msg.textContent = "";
        });
        body.querySelectorAll("._cp").forEach(b => b.onclick = () => { const v = $(b.dataset.k).value; if (v) navigator.clipboard.writeText(v).catch(() => {}); });
        nEl.value = "2024"; nEl.dispatchEvent(new Event("input"));

        return { destroy() {} };
    }
};
