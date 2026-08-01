"use strict";
window.I18N.register({
    en: { "widget.tx2_case": "Case Converter", "cat.tools": "Tools" },
    ru: { "widget.tx2_case": "Смена регистра", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.tx2_case = {
    id: "tx2_case",
    title: "widget.tx2_case",
    category: "tools",
    description: "Convert text between camelCase, snake_case, kebab-case, CONSTANT, Title and sentence case (live)",
    defaultSize: { w: 8, h: 6 },
    mount(body) {
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:6px;height:100%">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <select id="_c_mode" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:12px">
                <option value="camel">camelCase</option>
                <option value="pascal">PascalCase</option>
                <option value="snake">snake_case</option>
                <option value="kebab">kebab-case</option>
                <option value="constant">CONSTANT_CASE</option>
                <option value="title">Title Case</option>
                <option value="sentence">Sentence case</option>
                <option value="upper">UPPERCASE</option>
                <option value="lower">lowercase</option>
              </select>
              <button id="_c_copy" style="cursor:pointer">Copy</button>
              <span id="_c_msg" style="color:var(--text-dim);font-size:11px"></span>
            </div>
            <textarea id="_c_in" spellcheck="false" placeholder="Hello world example text" style="flex:1;min-height:50px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
            <textarea id="_c_out" spellcheck="false" readonly style="flex:1;min-height:50px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
          </div>`;
        const $ = s => body.querySelector(s);
        const inp = $("#_c_in"), out = $("#_c_out"), mode = $("#_c_mode"), msg = $("#_c_msg");

        const words = str => {
            const spaced = str
                .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
                .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
                .replace(/[_\-]+/g, " ")
                .replace(/[^A-Za-z0-9 ]+/g, " ");
            return spaced.split(/\s+/).filter(Boolean);
        };
        const cap = w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

        const run = () => {
            const src = inp.value;
            if (src.trim() === "") { out.value = ""; msg.textContent = ""; return; }
            const w = words(src).map(x => x.toLowerCase());
            let res = "";
            switch (mode.value) {
                case "camel": res = w.map((x, i) => i === 0 ? x : cap(x)).join(""); break;
                case "pascal": res = w.map(cap).join(""); break;
                case "snake": res = w.join("_"); break;
                case "kebab": res = w.join("-"); break;
                case "constant": res = w.join("_").toUpperCase(); break;
                case "title": res = w.map(cap).join(" "); break;
                case "sentence": res = w.length ? cap(w[0]) + (w.length > 1 ? " " + w.slice(1).join(" ") : "") : ""; break;
                case "upper": res = src.toUpperCase(); break;
                case "lower": res = src.toLowerCase(); break;
            }
            out.value = res;
            msg.innerHTML = `<span style="color:var(--text-dim)">${w.length} words</span>`;
        };
        const copy = () => { if (out.value) { navigator.clipboard.writeText(out.value); msg.innerHTML = `<span style="color:var(--accent)">copied</span>`; } };

        inp.addEventListener("input", run);
        mode.addEventListener("change", run);
        $("#_c_copy").addEventListener("click", copy);

        return { destroy() { inp.removeEventListener("input", run); mode.removeEventListener("change", run); } };
    }
};
