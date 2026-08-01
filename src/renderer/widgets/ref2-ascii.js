"use strict";
window.I18N.register({
    en: { "widget.ref2_ascii": "ASCII Table", "cat.reference": "Reference" },
    ru: { "widget.ref2_ascii": "Таблица ASCII", "cat.reference": "Справочник" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.ref2_ascii = {
    id: "ref2_ascii",
    title: "widget.ref2_ascii",
    category: "reference",
    description: "ASCII table (dec/hex/char), searchable, click a row to copy",
    defaultSize: { w: 8, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const names = {
            0: "NUL", 1: "SOH", 2: "STX", 3: "ETX", 4: "EOT", 5: "ENQ", 6: "ACK", 7: "BEL",
            8: "BS", 9: "TAB", 10: "LF", 11: "VT", 12: "FF", 13: "CR", 14: "SO", 15: "SI",
            16: "DLE", 17: "DC1", 18: "DC2", 19: "DC3", 20: "DC4", 21: "NAK", 22: "SYN", 23: "ETB",
            24: "CAN", 25: "EM", 26: "SUB", 27: "ESC", 28: "FS", 29: "GS", 30: "RS", 31: "US",
            32: "SPACE", 127: "DEL"
        };
        const rows = [];
        for (let i = 0; i < 128; i++) {
            const glyph = names[i] || String.fromCharCode(i);
            rows.push({ dec: i, hex: i.toString(16).toUpperCase().padStart(2, "0"), oct: i.toString(8).padStart(3, "0"), glyph, ctrl: !!names[i] });
        }

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px">
              <input id="_asc_q" placeholder="filter: dec / hex / char / name…" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:12px" />
              <div id="_asc_body" style="overflow:auto;flex:1">
                <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                  <thead><tr style="color:var(--text-dim);text-align:left">
                    <th style="padding:3px 6px;position:sticky;top:0;background:var(--bg-elevated)">Dec</th>
                    <th style="padding:3px 6px;position:sticky;top:0;background:var(--bg-elevated)">Hex</th>
                    <th style="padding:3px 6px;position:sticky;top:0;background:var(--bg-elevated)">Oct</th>
                    <th style="padding:3px 6px;position:sticky;top:0;background:var(--bg-elevated)">Char</th>
                  </tr></thead>
                  <tbody id="_asc_tb"></tbody>
                </table>
              </div>
              <div id="_asc_hint" style="color:var(--text-dim);font-size:10.5px">Click a row to copy the character.</div>
            </div>`;
        const q = body.querySelector("#_asc_q");
        const tb = body.querySelector("#_asc_tb");
        const hint = body.querySelector("#_asc_hint");

        const render = () => {
            const f = q.value.trim().toLowerCase();
            const list = rows.filter(r => {
                if (!f) return true;
                return r.dec.toString() === f || r.hex.toLowerCase() === f || ("0x" + r.hex.toLowerCase()) === f ||
                    r.glyph.toLowerCase().includes(f) || (!r.ctrl && r.glyph === f);
            });
            tb.innerHTML = list.map(r =>
                `<tr data-c="${esc(r.ctrl ? String.fromCharCode(r.dec) : r.glyph)}" style="cursor:pointer;border-top:1px solid var(--border)">
                   <td style="padding:3px 6px">${r.dec}</td>
                   <td style="padding:3px 6px;color:var(--accent)">0x${r.hex}</td>
                   <td style="padding:3px 6px;color:var(--text-dim)">${r.oct}</td>
                   <td style="padding:3px 6px">${esc(r.glyph)}</td>
                 </tr>`).join("") || `<tr><td colspan="4" style="padding:6px;color:var(--text-dim)">no match</td></tr>`;
        };

        const onClick = e => {
            const tr = e.target.closest("tr[data-c]");
            if (!tr) return;
            navigator.clipboard.writeText(tr.getAttribute("data-c")).then(() => {
                hint.textContent = "Copied!";
                setTimeout(() => { hint.textContent = "Click a row to copy the character."; }, 900);
            }).catch(() => {});
        };
        q.addEventListener("input", render);
        tb.addEventListener("click", onClick);
        render();
        return { destroy() { q.removeEventListener("input", render); tb.removeEventListener("click", onClick); } };
    }
};
