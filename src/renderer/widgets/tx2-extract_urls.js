"use strict";
window.I18N.register({
    en: { "widget.tx2_extract_urls": "Extract URLs", "cat.tools": "Tools" },
    ru: { "widget.tx2_extract_urls": "Извлечь URL", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.tx2_extract_urls = {
    id: "tx2_extract_urls",
    title: "widget.tx2_extract_urls",
    category: "tools",
    description: "Extract all URLs from text, with dedupe, sort and host-only options (live)",
    defaultSize: { w: 8, h: 6 },
    mount(body) {
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:6px;height:100%">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <label style="font-size:11px;color:var(--text-dim)"><input type="checkbox" id="_ur_uniq" checked> unique</label>
              <label style="font-size:11px;color:var(--text-dim)"><input type="checkbox" id="_ur_sort"> sort</label>
              <label style="font-size:11px;color:var(--text-dim)"><input type="checkbox" id="_ur_host"> hosts only</label>
              <button id="_ur_copy" style="cursor:pointer">Copy</button>
              <span id="_ur_msg" style="color:var(--text-dim);font-size:11px"></span>
            </div>
            <textarea id="_ur_in" spellcheck="false" placeholder="Paste text containing URLs..." style="flex:1;min-height:50px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
            <textarea id="_ur_out" spellcheck="false" readonly style="flex:1;min-height:50px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
          </div>`;
        const $ = s => body.querySelector(s);
        const inp = $("#_ur_in"), out = $("#_ur_out"), msg = $("#_ur_msg");
        const RE = /\b(?:https?|ftp|wss?):\/\/[^\s<>"'`)\]}]+/gi;

        const hostOf = u => {
            const m = /^[a-z]+:\/\/([^/\s:?#]+)/i.exec(u);
            return m ? m[1] : u;
        };
        const run = () => {
            const src = inp.value;
            if (src === "") { out.value = ""; msg.textContent = ""; return; }
            let list = (src.match(RE) || []).map(u => u.replace(/[.,;:!?)]+$/, ""));
            const found = list.length;
            if ($("#_ur_host").checked) list = list.map(hostOf);
            if ($("#_ur_uniq").checked) list = [...new Set(list)];
            if ($("#_ur_sort").checked) list = list.sort((a, b) => a.localeCompare(b));
            out.value = list.join("\n");
            msg.innerHTML = `<span style="color:var(--accent2)">${list.length} shown</span> · <span style="color:var(--text-dim)">${found} found</span>`;
        };
        const copy = () => { if (out.value) { navigator.clipboard.writeText(out.value); msg.innerHTML = `<span style="color:var(--accent)">copied</span>`; } };

        inp.addEventListener("input", run);
        ["_ur_uniq", "_ur_sort", "_ur_host"].forEach(id => $("#" + id).addEventListener("change", run));
        $("#_ur_copy").addEventListener("click", copy);

        return { destroy() { inp.removeEventListener("input", run); } };
    }
};
