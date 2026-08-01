"use strict";
window.I18N.register({
    en: { "widget.tx2_trimlines": "Trim Lines", "cat.tools": "Tools" },
    ru: { "widget.tx2_trimlines": "Обрезка строк", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.tx2_trimlines = {
    id: "tx2_trimlines",
    title: "widget.tx2_trimlines",
    category: "tools",
    description: "Trim whitespace on each line and optionally remove blank lines (live)",
    defaultSize: { w: 8, h: 6 },
    mount(body) {
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:6px;height:100%">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <select id="_tl_side" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:12px">
                <option value="both">trim both</option>
                <option value="start">trim start</option>
                <option value="end">trim end</option>
              </select>
              <label style="font-size:11px;color:var(--text-dim)"><input type="checkbox" id="_tl_blank" checked> remove blank lines</label>
              <label style="font-size:11px;color:var(--text-dim)"><input type="checkbox" id="_tl_collapse"> collapse inner spaces</label>
              <button id="_tl_copy" style="cursor:pointer">Copy</button>
              <span id="_tl_msg" style="color:var(--text-dim);font-size:11px"></span>
            </div>
            <textarea id="_tl_in" spellcheck="false" placeholder="  hello  &#10;&#10;   world   " style="flex:1;min-height:50px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
            <textarea id="_tl_out" spellcheck="false" readonly style="flex:1;min-height:50px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
          </div>`;
        const $ = s => body.querySelector(s);
        const inp = $("#_tl_in"), out = $("#_tl_out"), msg = $("#_tl_msg");

        const run = () => {
            const src = inp.value;
            if (src === "") { out.value = ""; msg.textContent = ""; return; }
            const side = $("#_tl_side").value, dropBlank = $("#_tl_blank").checked, collapse = $("#_tl_collapse").checked;
            let lines = src.replace(/\r\n?/g, "\n").split("\n");
            let removed = 0;
            const o = [];
            for (let l of lines) {
                if (collapse) l = l.replace(/[ \t]+/g, " ");
                if (side === "both") l = l.trim();
                else if (side === "start") l = l.replace(/^\s+/, "");
                else l = l.replace(/\s+$/, "");
                if (dropBlank && l.trim() === "") { removed++; continue; }
                o.push(l);
            }
            out.value = o.join("\n");
            msg.innerHTML = `<span style="color:var(--text-dim)">${o.length} lines</span> · <span style="color:var(--text-dim)">${removed} blank removed</span>`;
        };
        const copy = () => { if (out.value) { navigator.clipboard.writeText(out.value); msg.innerHTML = `<span style="color:var(--accent)">copied</span>`; } };

        inp.addEventListener("input", run);
        ["_tl_side", "_tl_blank", "_tl_collapse"].forEach(id => $("#" + id).addEventListener("change", run));
        $("#_tl_copy").addEventListener("click", copy);

        return { destroy() { inp.removeEventListener("input", run); } };
    }
};
