"use strict";
window.I18N.register({
    en: { "widget.txt_wordcount": "Word Count", "cat.tools": "Tools" },
    ru: { "widget.txt_wordcount": "Счётчик слов", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.txt_wordcount = {
    id: "txt_wordcount",
    title: "widget.txt_wordcount",
    category: "tools",
    description: "Live chars / words / lines / bytes counter (client-side)",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        const enc = new TextEncoder();
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:6px;height:100%">
            <div style="display:flex;gap:12px;flex-wrap:wrap;font-family:var(--font-mono);font-size:12px">
              <div class="metric-row"><span class="k">chars</span> <span class="v" id="_wc_ch" style="font-variant-numeric:tabular-nums">0</span></div>
              <div class="metric-row"><span class="k">words</span> <span class="v" id="_wc_wd" style="font-variant-numeric:tabular-nums">0</span></div>
              <div class="metric-row"><span class="k">lines</span> <span class="v" id="_wc_ln" style="font-variant-numeric:tabular-nums">0</span></div>
              <div class="metric-row"><span class="k">bytes</span> <span class="v" id="_wc_by" style="font-variant-numeric:tabular-nums">0</span></div>
              <div class="metric-row"><span class="k">no-ws</span> <span class="v" id="_wc_nw" style="font-variant-numeric:tabular-nums">0</span></div>
            </div>
            <textarea id="_wc_in" spellcheck="false" placeholder="Type or paste text…" style="flex:1;min-height:80px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
          </div>`;
        const $ = s => body.querySelector(s);
        const inp = $("#_wc_in");

        const run = () => {
            const t = inp.value;
            const chars = [...t].length;
            const words = (t.trim().match(/\S+/g) || []).length;
            const lines = t === "" ? 0 : t.replace(/\r\n?/g, "\n").split("\n").length;
            const bytes = enc.encode(t).length;
            const noWs = t.replace(/\s/g, "").length;
            $("#_wc_ch").textContent = chars.toLocaleString(window.I18N.locale());
            $("#_wc_wd").textContent = words.toLocaleString(window.I18N.locale());
            $("#_wc_ln").textContent = lines.toLocaleString(window.I18N.locale());
            $("#_wc_by").textContent = bytes.toLocaleString(window.I18N.locale());
            $("#_wc_nw").textContent = noWs.toLocaleString(window.I18N.locale());
        };
        inp.addEventListener("input", run);
        run();

        return { destroy() { inp.removeEventListener("input", run); } };
    }
};
