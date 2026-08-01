"use strict";
window.I18N.register({
    en: { "widget.tx2_extract_emails": "Extract Emails", "cat.tools": "Tools" },
    ru: { "widget.tx2_extract_emails": "Извлечь e-mail", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.tx2_extract_emails = {
    id: "tx2_extract_emails",
    title: "widget.tx2_extract_emails",
    category: "tools",
    description: "Extract all email addresses from text, with dedupe and sort (live)",
    defaultSize: { w: 8, h: 6 },
    mount(body) {
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:6px;height:100%">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <label style="font-size:11px;color:var(--text-dim)"><input type="checkbox" id="_em_uniq" checked> unique</label>
              <label style="font-size:11px;color:var(--text-dim)"><input type="checkbox" id="_em_sort"> sort</label>
              <label style="font-size:11px;color:var(--text-dim)"><input type="checkbox" id="_em_lc"> lowercase</label>
              <button id="_em_copy" style="cursor:pointer">Copy</button>
              <span id="_em_msg" style="color:var(--text-dim);font-size:11px"></span>
            </div>
            <textarea id="_em_in" spellcheck="false" placeholder="Paste text containing emails..." style="flex:1;min-height:50px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
            <textarea id="_em_out" spellcheck="false" readonly style="flex:1;min-height:50px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
          </div>`;
        const $ = s => body.querySelector(s);
        const inp = $("#_em_in"), out = $("#_em_out"), msg = $("#_em_msg");
        const RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;

        const run = () => {
            const src = inp.value;
            if (src === "") { out.value = ""; msg.textContent = ""; return; }
            let list = src.match(RE) || [];
            const found = list.length;
            if ($("#_em_lc").checked) list = list.map(x => x.toLowerCase());
            if ($("#_em_uniq").checked) list = [...new Set(list)];
            if ($("#_em_sort").checked) list = list.sort((a, b) => a.localeCompare(b));
            out.value = list.join("\n");
            msg.innerHTML = `<span style="color:var(--accent2)">${list.length} shown</span> · <span style="color:var(--text-dim)">${found} found</span>`;
        };
        const copy = () => { if (out.value) { navigator.clipboard.writeText(out.value); msg.innerHTML = `<span style="color:var(--accent)">copied</span>`; } };

        inp.addEventListener("input", run);
        ["_em_uniq", "_em_sort", "_em_lc"].forEach(id => $("#" + id).addEventListener("change", run));
        $("#_em_copy").addEventListener("click", copy);

        return { destroy() { inp.removeEventListener("input", run); } };
    }
};
