"use strict";
window.I18N.register({
    en: { "widget.tx2_occurrences": "Count Occurrences", "cat.tools": "Tools" },
    ru: { "widget.tx2_occurrences": "Счёт вхождений", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.tx2_occurrences = {
    id: "tx2_occurrences",
    title: "widget.tx2_occurrences",
    category: "tools",
    description: "Count occurrences of a substring or regex in the text, with a highlighted preview (live)",
    defaultSize: { w: 8, h: 6 },
    mount(body) {
        const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:6px;height:100%">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <input id="_oc_pat" placeholder="pattern" style="flex:1;min-width:100px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:12px">
              <label style="font-size:11px;color:var(--text-dim)"><input type="checkbox" id="_oc_re"> regex</label>
              <label style="font-size:11px;color:var(--text-dim)"><input type="checkbox" id="_oc_ci"> ignore case</label>
              <span id="_oc_msg" style="color:var(--text-dim);font-size:11px"></span>
            </div>
            <textarea id="_oc_in" spellcheck="false" placeholder="text to search in" style="flex:1;min-height:50px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
            <div id="_oc_prev" style="flex:1;min-height:50px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text-dim);border:1px solid var(--border);border-radius:4px;padding:6px"></div>
          </div>`;
        const $ = s => body.querySelector(s);
        const inp = $("#_oc_in"), pat = $("#_oc_pat"), prev = $("#_oc_prev"), msg = $("#_oc_msg");

        const run = () => {
            const src = inp.value, p = pat.value;
            prev.innerHTML = "";
            if (src === "" || p === "") { msg.textContent = ""; return; }
            const ci = $("#_oc_ci").checked, useRe = $("#_oc_re").checked;
            let re;
            try {
                const body2 = useRe ? p : p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                re = new RegExp(body2, "g" + (ci ? "i" : ""));
            } catch (e) {
                msg.innerHTML = `<span style="color:var(--danger)">bad regex: ${esc(e.message)}</span>`;
                return;
            }
            let count = 0, last = 0, html = "", m, guard = 0;
            re.lastIndex = 0;
            while ((m = re.exec(src)) !== null) {
                count++;
                html += esc(src.slice(last, m.index)) + `<span style="background:var(--accent);color:var(--bg-elevated);border-radius:2px">${esc(m[0])}</span>`;
                last = m.index + m[0].length;
                if (m[0].length === 0) re.lastIndex++;
                if (++guard > 100000) break;
            }
            html += esc(src.slice(last));
            prev.innerHTML = html;
            msg.innerHTML = count ? `<span style="color:var(--accent2)">${count} matches</span>` : `<span style="color:var(--text-dim)">no matches</span>`;
        };

        inp.addEventListener("input", run);
        pat.addEventListener("input", run);
        ["_oc_re", "_oc_ci"].forEach(id => $("#" + id).addEventListener("change", run));

        return { destroy() { inp.removeEventListener("input", run); pat.removeEventListener("input", run); } };
    }
};
