"use strict";
window.I18N.register({
    en: { "widget.txt_slugify": "Slugify", "cat.tools": "Tools" },
    ru: { "widget.txt_slugify": "Слаги (Slugify)", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.txt_slugify = {
    id: "txt_slugify",
    title: "widget.txt_slugify",
    category: "tools",
    description: "Turn text into a clean URL slug (client-side, live)",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        // Transliteration map for common non-ASCII (incl. Cyrillic) so slugs stay meaningful.
        const CYR = { "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya" };

        const slug = (text, sep) => {
            let s = text.toLowerCase();
            // strip diacritics
            s = s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
            // transliterate cyrillic
            s = s.replace(/[а-яё]/g, ch => (CYR[ch] !== undefined ? CYR[ch] : ch));
            // replace anything not a-z0-9 with sep
            s = s.replace(/[^a-z0-9]+/g, sep);
            // collapse and trim separators
            const re = new RegExp("\\" + sep + "+", "g");
            s = s.replace(re, sep);
            const trimRe = new RegExp("^\\" + sep + "+|\\" + sep + "+$", "g");
            return s.replace(trimRe, "");
        };

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:6px;height:100%">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <label style="font-size:11px;color:var(--text-dim)">sep
                <select id="_sl_sep" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border)"><option value="-">-</option><option value="_">_</option><option value=".">.</option></select>
              </label>
              <button id="_sl_copy" style="cursor:pointer">Copy</button>
              <span id="_sl_msg" style="color:var(--text-dim);font-size:11px"></span>
            </div>
            <textarea id="_sl_in" spellcheck="false" placeholder="My Awesome Blog Post!  (Привет)" style="flex:1;min-height:40px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
            <input id="_sl_out" readonly style="font-family:var(--font-mono);font-size:13px;background:var(--bg-elevated);color:var(--accent);border:1px solid var(--border);border-radius:4px;padding:8px" />
          </div>`;
        const $ = s => body.querySelector(s);
        const inp = $("#_sl_in"), out = $("#_sl_out"), msg = $("#_sl_msg");

        const run = () => {
            const s = slug(inp.value, $("#_sl_sep").value);
            out.value = s;
            msg.textContent = s ? s.length + " chars" : "";
        };
        const copy = () => { if (out.value) { navigator.clipboard.writeText(out.value); msg.innerHTML = `<span style="color:var(--accent)">copied</span>`; } };

        inp.addEventListener("input", run);
        $("#_sl_sep").addEventListener("change", run);
        $("#_sl_copy").addEventListener("click", copy);

        return { destroy() { inp.removeEventListener("input", run); } };
    }
};
