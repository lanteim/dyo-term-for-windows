"use strict";
window.I18N.register({
    en: { "widget.ref2_unicode": "Unicode Inspector", "cat.reference": "Reference" },
    ru: { "widget.ref2_unicode": "Инспектор Unicode", "cat.reference": "Справочник" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.ref2_unicode = {
    id: "ref2_unicode",
    title: "widget.ref2_unicode",
    category: "reference",
    description: "Char → code point / UTF-8 bytes, and code point → char",
    defaultSize: { w: 8, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const enc = new TextEncoder();
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;overflow:auto">
              <div>
                <div style="color:var(--text-dim);font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Text → code points</div>
                <input id="_uc_in" placeholder="type any characters…" value="A→😀" style="width:100%;box-sizing:border-box;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono);font-size:13px" />
                <div id="_uc_out" style="margin-top:6px;overflow:auto"></div>
              </div>
              <div>
                <div style="color:var(--text-dim);font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Code point → char (e.g. U+1F600, 0x41, 65)</div>
                <input id="_uc_cp" placeholder="U+1F600" style="width:100%;box-sizing:border-box;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono);font-size:13px" />
                <div id="_uc_cpout" style="margin-top:6px;font-family:var(--font-mono);font-size:13px"></div>
              </div>
            </div>`;
        const inp = body.querySelector("#_uc_in");
        const out = body.querySelector("#_uc_out");
        const cp = body.querySelector("#_uc_cp");
        const cpout = body.querySelector("#_uc_cpout");

        const hex = n => n.toString(16).toUpperCase();
        const bytesOf = ch => Array.from(enc.encode(ch)).map(b => hex(b).padStart(2, "0")).join(" ");

        const renderText = () => {
            const chars = Array.from(inp.value);
            if (!chars.length) { out.innerHTML = `<div style="color:var(--text-dim);font-size:11px">…</div>`; return; }
            out.innerHTML = `<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
              <thead><tr style="color:var(--text-dim);text-align:left">
                <th style="padding:3px 6px">Char</th><th style="padding:3px 6px">Code point</th><th style="padding:3px 6px">Dec</th><th style="padding:3px 6px">UTF-8</th>
              </tr></thead><tbody>` +
                chars.map(ch => {
                    const c = ch.codePointAt(0);
                    return `<tr style="border-top:1px solid var(--border)">
                      <td style="padding:3px 6px">${esc(ch)}</td>
                      <td style="padding:3px 6px;color:var(--accent)">U+${hex(c).padStart(4, "0")}</td>
                      <td style="padding:3px 6px;color:var(--text-dim)">${c}</td>
                      <td style="padding:3px 6px">${bytesOf(ch)}</td>
                    </tr>`;
                }).join("") + `</tbody></table>`;
        };

        const renderCp = () => {
            const raw = cp.value.trim();
            if (!raw) { cpout.innerHTML = `<span style="color:var(--text-dim)">…</span>`; return; }
            let n = NaN;
            const m = raw.replace(/^U\+/i, "0x");
            if (/^0x[0-9a-f]+$/i.test(m)) n = parseInt(m, 16);
            else if (/^\d+$/.test(raw)) n = parseInt(raw, 10);
            if (!Number.isInteger(n) || n < 0 || n > 0x10FFFF) {
                cpout.innerHTML = `<span style="color:var(--danger)">invalid code point</span>`; return;
            }
            let ch;
            try { ch = String.fromCodePoint(n); } catch (e) { cpout.innerHTML = `<span style="color:var(--danger)">out of range</span>`; return; }
            cpout.innerHTML = `<span style="font-size:22px">${esc(ch)}</span>
              <span style="color:var(--accent);margin-left:10px">U+${hex(n).padStart(4, "0")}</span>
              <span style="color:var(--text-dim);margin-left:10px">dec ${n}</span>
              <span style="color:var(--text-dim);margin-left:10px">UTF-8 ${bytesOf(ch)}</span>`;
        };

        inp.addEventListener("input", renderText);
        cp.addEventListener("input", renderCp);
        renderText(); renderCp();
        return { destroy() { inp.removeEventListener("input", renderText); cp.removeEventListener("input", renderCp); } };
    }
};
