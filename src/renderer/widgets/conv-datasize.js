"use strict";
window.I18N.register({
    en: { "widget.conv_datasize": "Data Size Converter", "cat.tools": "Tools" },
    ru: { "widget.conv_datasize": "Конвертер объёма данных", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.conv_datasize = {
    id: "conv_datasize",
    title: "widget.conv_datasize",
    category: "tools",
    description: "Live bytes / KB-TB (decimal 1000) and KiB-TiB (binary 1024)",
    defaultSize: { w: 6, h: 6 },
    mount(body) {
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:12px;width:100%;box-sizing:border-box";
        const lbl = "color:var(--text-dim);font-size:11px;margin-bottom:2px";
        const copyBtn = "background:var(--bg-elevated);color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:4px 8px;cursor:pointer;font-family:var(--font-mono);font-size:11px";

        // key: [label, bytesPerUnit]
        const units = [
            ["B", "Bytes", 1],
            ["KB", "KB (1000)", 1e3], ["MB", "MB (1000²)", 1e6], ["GB", "GB (1000³)", 1e9], ["TB", "TB (1000⁴)", 1e12],
            ["KiB", "KiB (1024)", 1024], ["MiB", "MiB (1024²)", 1048576], ["GiB", "GiB (1024³)", 1073741824], ["TiB", "TiB (1024⁴)", 1099511627776]
        ];
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:6px;height:100%;overflow:auto;font-family:var(--font-mono)">
            ${units.map(([k, t]) => `<div style="display:flex;gap:6px;align-items:center"><div style="${lbl};margin:0;width:92px;flex:none">${t}</div><input class="_${k}" spellcheck="false" style="${inp}"><button data-k="_${k}" class="_cp" style="${copyBtn}">copy</button></div>`).join("")}
            <div class="_msg" style="${lbl};margin-top:auto"></div>
          </div>`;
        const $ = s => body.querySelector(s);
        const els = {}; units.forEach(([k]) => els[k] = $("._" + k));
        const msg = $("._msg");
        const fmt = n => {
            if (n === 0) return "0";
            if (n >= 1e15 || (n !== 0 && Math.abs(n) < 1e-6)) return n.toExponential(6).replace(/\.?0+e/, "e");
            const r = Math.round(n * 1e6) / 1e6;
            return String(r);
        };
        const update = from => {
            const raw = els[from].value.trim();
            if (raw === "") { units.forEach(([k]) => { if (k !== from) els[k].value = ""; }); msg.textContent = ""; return; }
            const n = Number(raw);
            if (!isFinite(n) || n < 0) { msg.textContent = "invalid (non-negative number expected)"; return; }
            const perUnit = units.find(u => u[0] === from)[2];
            const bytes = n * perUnit;
            units.forEach(([k, , per]) => { if (k !== from) els[k].value = fmt(bytes / per); });
            msg.textContent = "";
        };
        units.forEach(([k]) => els[k].addEventListener("input", () => update(k)));
        body.querySelectorAll("._cp").forEach(b => b.onclick = () => { const v = $(b.dataset.k).value; if (v) navigator.clipboard.writeText(v).catch(() => {}); });
        els.MB.value = "1"; update("MB");

        return { destroy() {} };
    }
};
