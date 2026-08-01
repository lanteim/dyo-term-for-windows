"use strict";
window.I18N.register({
    en: { "widget.tx2_reverse": "Reverse Text", "cat.tools": "Tools" },
    ru: { "widget.tx2_reverse": "Реверс текста", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.tx2_reverse = {
    id: "tx2_reverse",
    title: "widget.tx2_reverse",
    category: "tools",
    description: "Reverse characters, lines or words of the input text (live)",
    defaultSize: { w: 8, h: 6 },
    mount(body) {
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:6px;height:100%">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <select id="_rv_mode" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:12px">
                <option value="chars">reverse characters</option>
                <option value="lines">reverse line order</option>
                <option value="words">reverse word order</option>
                <option value="charsPerLine">reverse chars per line</option>
              </select>
              <button id="_rv_copy" style="cursor:pointer">Copy</button>
              <span id="_rv_msg" style="color:var(--text-dim);font-size:11px"></span>
            </div>
            <textarea id="_rv_in" spellcheck="false" placeholder="Hello world" style="flex:1;min-height:50px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
            <textarea id="_rv_out" spellcheck="false" readonly style="flex:1;min-height:50px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
          </div>`;
        const $ = s => body.querySelector(s);
        const inp = $("#_rv_in"), out = $("#_rv_out"), mode = $("#_rv_mode"), msg = $("#_rv_msg");
        const rev = s => Array.from(s).reverse().join("");

        const run = () => {
            const src = inp.value;
            if (src === "") { out.value = ""; msg.textContent = ""; return; }
            let res = "";
            switch (mode.value) {
                case "chars": res = rev(src); break;
                case "lines": res = src.replace(/\r\n?/g, "\n").split("\n").reverse().join("\n"); break;
                case "words": res = src.split(/(\s+)/).reverse().join(""); break;
                case "charsPerLine": res = src.replace(/\r\n?/g, "\n").split("\n").map(rev).join("\n"); break;
            }
            out.value = res;
            msg.innerHTML = `<span style="color:var(--text-dim)">${Array.from(src).length} chars</span>`;
        };
        const copy = () => { if (out.value) { navigator.clipboard.writeText(out.value); msg.innerHTML = `<span style="color:var(--accent)">copied</span>`; } };

        inp.addEventListener("input", run);
        mode.addEventListener("change", run);
        $("#_rv_copy").addEventListener("click", copy);

        return { destroy() { inp.removeEventListener("input", run); mode.removeEventListener("change", run); } };
    }
};
