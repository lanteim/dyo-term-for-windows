"use strict";
window.I18N.register({
    en: { "widget.extra_csv": "CSV Viewer", "cat.data": "Data" },
    ru: { "widget.extra_csv": "Просмотр CSV", "cat.data": "Данные" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.extra_csv = {
    id: "extra_csv",
    title: "widget.extra_csv",
    category: "data",
    description: "Paste CSV, render as a table (first row = headers)",
    defaultSize: { w: 10, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const CAP = 200;

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
              <div style="display:flex;gap:6px;align-items:center">
                <button class="_go" style="border-color:var(--accent)">Render</button>
                <button class="_clr">Clear</button>
                <span class="_st" style="color:var(--text-dim);margin-left:auto"></span>
              </div>
              <textarea class="_in" placeholder="name,age,city&#10;Ann,30,NY&#10;Bob,25,LA" style="height:34%;resize:none"></textarea>
              <div class="_out" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        $("._in").style.cssText += ";background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono);box-sizing:border-box";
        ["._go", "._clr"].forEach(s => { $(s).style.cssText += ";background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;cursor:pointer;font-family:var(--font-mono)"; });

        // RFC-4180-ish parser: quotes, escaped quotes, commas & newlines inside quotes.
        const parse = text => {
            const rows = []; let row = [], field = "", i = 0, q = false;
            while (i < text.length) {
                const ch = text[i];
                if (q) {
                    if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } q = false; i++; continue; }
                    field += ch; i++; continue;
                }
                if (ch === '"') { q = true; i++; continue; }
                if (ch === ",") { row.push(field); field = ""; i++; continue; }
                if (ch === "\r") { i++; continue; }
                if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
                field += ch; i++;
            }
            if (field.length || row.length) { row.push(field); rows.push(row); }
            return rows.filter(r => !(r.length === 1 && r[0] === ""));
        };

        const render = () => {
            const text = $("._in").value;
            if (!text.trim()) { $("._out").innerHTML = `<div style="padding:10px;color:var(--text-dim)">Paste CSV above and press Render.</div>`; $("._st").textContent = ""; return; }
            let rows;
            try { rows = parse(text); } catch (e) { $("._out").innerHTML = `<div style="padding:10px;color:var(--danger)">Parse error: ${esc(e.message)}</div>`; return; }
            if (!rows.length) { $("._out").innerHTML = `<div style="padding:10px;color:var(--text-dim)">No rows found.</div>`; return; }
            const head = rows[0];
            const bodyRows = rows.slice(1, 1 + CAP);
            const th = head.map(h => `<th style="text-align:left;padding:5px 8px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--bg-elevated);white-space:nowrap">${esc(h)}</th>`).join("");
            const trs = bodyRows.map(r => `<tr>${head.map((_, ci) => `<td style="padding:4px 8px;border-bottom:1px solid var(--border);white-space:nowrap">${esc(r[ci] == null ? "" : r[ci])}</td>`).join("")}</tr>`).join("");
            $("._out").innerHTML = `<table style="border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
            const total = rows.length - 1;
            $("._st").textContent = `${head.length} cols · ${total} rows${total > CAP ? " (showing " + CAP + ")" : ""}`;
        };
        $("._go").onclick = render;
        $("._clr").onclick = () => { $("._in").value = ""; render(); };
        render();

        return { destroy: () => {} };
    }
};
