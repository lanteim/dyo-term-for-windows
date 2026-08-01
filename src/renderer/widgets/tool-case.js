"use strict";
window.I18N.register({
    en: { "widget.tool_case": "Case Converter", "cat.tools": "Tools" },
    ru: { "widget.tool_case": "Конвертер Регистра", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.tool_case = {
    id: "tool_case",
    title: "widget.tool_case",
    category: "tools",
    description: "Convert between camel/snake/kebab/CONST/Title",
    defaultSize: { w: 7, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono);font-size:13px";
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:8px;height:100%">
                <input class="cs-in" placeholder="type any identifier or phrase…" style="${inp}" />
                <div class="cs-out" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:5px"></div>
            </div>`;
        const cin = body.querySelector(".cs-in");
        const cout = body.querySelector(".cs-out");
        cin.value = "helloWorld example_text";

        const words = s => {
            return String(s)
                .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
                .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
                .split(/[\s_\-.]+/)
                .filter(Boolean)
                .map(w => w.toLowerCase());
        };
        const CASES = {
            "camelCase": w => w.map((x, i) => i === 0 ? x : x.charAt(0).toUpperCase() + x.slice(1)).join(""),
            "PascalCase": w => w.map(x => x.charAt(0).toUpperCase() + x.slice(1)).join(""),
            "snake_case": w => w.join("_"),
            "kebab-case": w => w.join("-"),
            "CONSTANT_CASE": w => w.map(x => x.toUpperCase()).join("_"),
            "Title Case": w => w.map(x => x.charAt(0).toUpperCase() + x.slice(1)).join(" ")
        };
        const run = () => {
            const w = words(cin.value);
            cout.innerHTML = "";
            for (const name in CASES) {
                const val = w.length ? CASES[name](w) : "";
                const row = document.createElement("div");
                row.className = "metric-row";
                row.style.cursor = "pointer";
                row.title = "Click to copy";
                row.innerHTML = `<span class="k">${esc(name)}</span><span class="v">${esc(val) || "—"}</span>`;
                row.onclick = () => { if (val) navigator.clipboard.writeText(val).catch(() => {}); };
                cout.appendChild(row);
            }
        };
        cin.oninput = run;
        run();
        return { destroy() { cin.oninput = null; } };
    }
};
