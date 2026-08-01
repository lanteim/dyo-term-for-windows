"use strict";
window.I18N.register({
    en: { "widget.conv_numbase2": "Number Base Converter", "cat.tools": "Tools" },
    ru: { "widget.conv_numbase2": "Конвертер систем счисления", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.conv_numbase2 = {
    id: "conv_numbase2",
    title: "widget.conv_numbase2",
    category: "tools",
    description: "Live binary / octal / decimal / hex conversion (arbitrary precision)",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:12px;width:100%;box-sizing:border-box";
        const lbl = "color:var(--text-dim);font-size:11px;margin-bottom:2px";
        const copyBtn = "background:var(--bg-elevated);color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:4px 8px;cursor:pointer;font-family:var(--font-mono);font-size:11px";

        const rows = [["bin", "Binary (2)", 2], ["oct", "Octal (8)", 8], ["dec", "Decimal (10)", 10], ["hex", "Hex (16)", 16]];
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:8px;height:100%;overflow:auto;font-family:var(--font-mono)">
            ${rows.map(([k, t]) => `<div><div style="${lbl}">${t}</div><div style="display:flex;gap:6px"><input class="_${k}" spellcheck="false" style="${inp}"><button data-k="${k}" class="_cp" style="${copyBtn}">copy</button></div></div>`).join("")}
            <div class="_msg" style="${lbl};margin-top:auto"></div>
          </div>`;
        const $ = s => body.querySelector(s);
        const els = { bin: $("._bin"), oct: $("._oct"), dec: $("._dec"), hex: $("._hex") };
        const msg = $("._msg");
        const valid = { bin: /^[01]+$/, oct: /^[0-7]+$/, dec: /^\d+$/, hex: /^[0-9a-fA-F]+$/ };
        const bases = { bin: 2n, oct: 8n, dec: 10n, hex: 16n };
        const digitVal = c => { const n = "0123456789abcdef".indexOf(c.toLowerCase()); return n; };

        const parse = (str, base) => {
            let v = 0n;
            for (const c of str) { const d = BigInt(digitVal(c)); if (d < 0n || d >= base) return null; v = v * base + d; }
            return v;
        };
        const update = (from) => {
            const raw = els[from].value.trim().replace(/^0[xXbBoO]/, "");
            if (raw === "") { for (const k in els) if (k !== from) els[k].value = ""; msg.textContent = ""; return; }
            if (!valid[from].test(raw)) { msg.textContent = `invalid ${from} digits`; return; }
            let v;
            try { v = parse(raw, bases[from]); } catch (e) { msg.textContent = "parse error"; return; }
            if (v === null) { msg.textContent = "out of range"; return; }
            if (from !== "bin") els.bin.value = v.toString(2);
            if (from !== "oct") els.oct.value = v.toString(8);
            if (from !== "dec") els.dec.value = v.toString(10);
            if (from !== "hex") els.hex.value = v.toString(16).toUpperCase();
            msg.textContent = "";
        };
        for (const k in els) els[k].addEventListener("input", () => update(k));
        body.querySelectorAll("._cp").forEach(b => b.onclick = () => { const v = els[b.dataset.k].value; if (v) navigator.clipboard.writeText(v).catch(() => {}); });
        els.dec.value = "255"; update("dec");

        return { destroy() {} };
    }
};
