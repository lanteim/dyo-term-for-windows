"use strict";
window.I18N.register({
    en: { "widget.txt_dedup": "Dedup Lines", "cat.tools": "Tools" },
    ru: { "widget.txt_dedup": "Удаление дублей", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.txt_dedup = {
    id: "txt_dedup",
    title: "widget.txt_dedup",
    category: "tools",
    description: "Remove duplicate lines, keeping original order (client-side, live)",
    defaultSize: { w: 8, h: 6 },
    mount(body) {
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:6px;height:100%">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <label style="font-size:11px;color:var(--text-dim)"><input type="checkbox" id="_dd_ci"> ignore case</label>
              <label style="font-size:11px;color:var(--text-dim)"><input type="checkbox" id="_dd_trim"> trim</label>
              <label style="font-size:11px;color:var(--text-dim)"><input type="checkbox" id="_dd_blank" checked> drop blanks</label>
              <button id="_dd_copy" style="cursor:pointer">Copy</button>
              <span id="_dd_msg" style="color:var(--text-dim);font-size:11px"></span>
            </div>
            <textarea id="_dd_in" spellcheck="false" placeholder="a&#10;b&#10;a&#10;c&#10;b" style="flex:1;min-height:60px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
            <textarea id="_dd_out" spellcheck="false" readonly style="flex:1;min-height:60px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
          </div>`;
        const $ = s => body.querySelector(s);
        const inp = $("#_dd_in"), out = $("#_dd_out"), msg = $("#_dd_msg");

        const run = () => {
            const src = inp.value;
            if (src.trim() === "") { out.value = ""; msg.textContent = ""; return; }
            const ci = $("#_dd_ci").checked, trim = $("#_dd_trim").checked, dropBlank = $("#_dd_blank").checked;
            let lines = src.replace(/\r\n?/g, "\n").split("\n");
            if (trim) lines = lines.map(l => l.trim());
            const seen = new Set(), o = [];
            let removed = 0;
            for (const l of lines) {
                if (dropBlank && l.trim() === "") { removed++; continue; }
                const k = ci ? l.toLowerCase() : l;
                if (seen.has(k)) { removed++; continue; }
                seen.add(k); o.push(l);
            }
            out.value = o.join("\n");
            msg.innerHTML = `<span style="color:var(--accent2)">${o.length} kept</span> · <span style="color:var(--text-dim)">${removed} removed</span>`;
        };
        const copy = () => { if (out.value) { navigator.clipboard.writeText(out.value); msg.innerHTML = `<span style="color:var(--accent)">copied</span>`; } };

        inp.addEventListener("input", run);
        ["_dd_ci", "_dd_trim", "_dd_blank"].forEach(id => $("#" + id).addEventListener("change", run));
        $("#_dd_copy").addEventListener("click", copy);

        return { destroy() { inp.removeEventListener("input", run); } };
    }
};
