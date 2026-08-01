"use strict";
window.I18N.register({
    en: { "widget.tool_jsonpath": "JSON Path", "cat.tools": "Tools" },
    ru: { "widget.tool_jsonpath": "JSON Путь", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.tool_jsonpath = {
    id: "tool_jsonpath",
    title: "widget.tool_jsonpath",
    category: "tools",
    description: "Extract a value by dotted path from JSON",
    defaultSize: { w: 8, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono);font-size:12px";
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:8px;height:100%">
                <textarea class="jp-json" placeholder="paste JSON…" style="${inp};flex:1;resize:none;min-height:60px" spellcheck="false"></textarea>
                <input class="jp-path" placeholder="a.b[0].c" style="${inp}" />
                <div class="jp-err" style="font-size:11px;color:var(--danger);min-height:12px"></div>
                <div class="jp-out" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:8px;background:var(--bg-elevated);font-family:var(--font-mono);font-size:12px;white-space:pre-wrap;word-break:break-word;cursor:pointer" title="Click to copy"></div>
            </div>`;
        const jIn = body.querySelector(".jp-json");
        const pIn = body.querySelector(".jp-path");
        const err = body.querySelector(".jp-err");
        const out = body.querySelector(".jp-out");
        jIn.value = '{"user":{"name":"alice","roles":["admin","dev"]},"count":3}';
        pIn.value = "user.roles[1]";

        const tokenize = path => {
            const toks = [];
            const re = /\[(\d+)\]|\.?([A-Za-z_$][\w$]*)/g;
            let m, consumed = 0;
            while ((m = re.exec(path)) !== null) {
                if (m.index !== consumed) return null;
                consumed = re.lastIndex;
                if (m[1] !== undefined) toks.push(parseInt(m[1], 10));
                else toks.push(m[2]);
            }
            if (consumed !== path.length) return null;
            return toks;
        };
        const run = () => {
            err.textContent = "";
            let data;
            try { data = JSON.parse(jIn.value); }
            catch (e) { err.textContent = "Invalid JSON: " + e.message; out.textContent = ""; return; }
            const path = pIn.value.trim();
            if (!path) { out.textContent = JSON.stringify(data, null, 2); return; }
            const toks = tokenize(path);
            if (!toks) { err.textContent = "Invalid path syntax"; out.textContent = ""; return; }
            let cur = data;
            for (const t of toks) {
                if (cur == null) { err.textContent = "Path not found (null before '" + t + "')"; out.textContent = ""; return; }
                cur = cur[t];
                if (cur === undefined) { err.textContent = "Key/index '" + t + "' not found"; out.textContent = ""; return; }
            }
            out.textContent = typeof cur === "object" ? JSON.stringify(cur, null, 2) : String(cur);
        };
        out.onclick = () => navigator.clipboard.writeText(out.textContent).catch(() => {});
        jIn.oninput = run;
        pIn.oninput = run;
        run();
        return { destroy() { jIn.oninput = pIn.oninput = out.onclick = null; } };
    }
};
