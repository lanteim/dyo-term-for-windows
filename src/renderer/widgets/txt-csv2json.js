"use strict";
window.I18N.register({
    en: { "widget.txt_csv2json": "CSV → JSON", "cat.tools": "Tools" },
    ru: { "widget.txt_csv2json": "CSV → JSON", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.txt_csv2json = {
    id: "txt_csv2json",
    title: "widget.txt_csv2json",
    category: "tools",
    description: "Convert CSV (header row) to a JSON array (client-side)",
    defaultSize: { w: 8, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

        // RFC4180-ish CSV parser supporting quotes, escaped quotes, and configurable delimiter.
        const parseCSV = (text, delim) => {
            const rows = []; let row = [], field = "", i = 0, inQ = false;
            const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
            while (i < s.length) {
                const c = s[i];
                if (inQ) {
                    if (c === '"') { if (s[i + 1] === '"') { field += '"'; i += 2; continue; } inQ = false; i++; continue; }
                    field += c; i++; continue;
                }
                if (c === '"') { inQ = true; i++; continue; }
                if (c === delim) { row.push(field); field = ""; i++; continue; }
                if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
                field += c; i++;
            }
            if (field !== "" || row.length) { row.push(field); rows.push(row); }
            return rows.filter(r => !(r.length === 1 && r[0] === ""));
        };
        const coerce = (v, on) => {
            if (!on) return v;
            const t = v.trim();
            if (t === "") return v;
            if (t === "true") return true;
            if (t === "false") return false;
            if (/^[+-]?\d+$/.test(t)) return parseInt(t, 10);
            if (/^[+-]?(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?$/.test(t)) return parseFloat(t);
            return v;
        };

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:6px;height:100%">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <button id="_c2j_go" style="cursor:pointer">Convert →</button>
              <button id="_c2j_copy" style="cursor:pointer">Copy</button>
              <label style="font-size:11px;color:var(--text-dim)">delim
                <select id="_c2j_d" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border)"><option value=",">,</option><option value=";">;</option><option value="\t">tab</option><option value="|">|</option></select>
              </label>
              <label style="font-size:11px;color:var(--text-dim)"><input type="checkbox" id="_c2j_t" checked> typed</label>
              <span id="_c2j_msg" style="color:var(--text-dim);font-size:11px"></span>
            </div>
            <textarea id="_c2j_in" spellcheck="false" placeholder="name,age,active&#10;Ann,30,true&#10;Bob,25,false" style="flex:1;min-height:60px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
            <textarea id="_c2j_out" spellcheck="false" readonly style="flex:1;min-height:60px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
          </div>`;
        const $ = s => body.querySelector(s);
        const inp = $("#_c2j_in"), out = $("#_c2j_out"), msg = $("#_c2j_msg");

        const run = () => {
            const src = inp.value;
            if (!src.trim()) { out.value = ""; msg.textContent = ""; return; }
            try {
                const delim = $("#_c2j_d").value;
                const typed = $("#_c2j_t").checked;
                const rows = parseCSV(src, delim);
                if (!rows.length) { out.value = "[]"; msg.textContent = ""; return; }
                const header = rows[0];
                const arr = rows.slice(1).map(r => {
                    const o = {};
                    header.forEach((h, idx) => { o[h] = coerce(r[idx] === undefined ? "" : r[idx], typed); });
                    return o;
                });
                out.value = JSON.stringify(arr, null, 2);
                msg.innerHTML = `<span style="color:var(--accent2)">${arr.length} rows, ${header.length} cols</span>`;
            } catch (e) {
                out.value = "";
                msg.innerHTML = `<span style="color:var(--danger)">${esc(e.message)}</span>`;
            }
        };
        const copy = () => { if (out.value) { navigator.clipboard.writeText(out.value); msg.innerHTML = `<span style="color:var(--accent)">copied</span>`; } };

        inp.addEventListener("input", run);
        $("#_c2j_go").addEventListener("click", run);
        $("#_c2j_copy").addEventListener("click", copy);
        $("#_c2j_d").addEventListener("change", run);
        $("#_c2j_t").addEventListener("change", run);

        return { destroy() { inp.removeEventListener("input", run); } };
    }
};
