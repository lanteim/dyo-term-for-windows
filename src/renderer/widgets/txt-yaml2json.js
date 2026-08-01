"use strict";
window.I18N.register({
    en: { "widget.txt_yaml2json": "YAML → JSON", "cat.tools": "Tools" },
    ru: { "widget.txt_yaml2json": "YAML → JSON", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.txt_yaml2json = {
    id: "txt_yaml2json",
    title: "widget.txt_yaml2json",
    category: "tools",
    description: "Convert a simple YAML subset to JSON (client-side)",
    defaultSize: { w: 8, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

        // Parse a scalar value from YAML into a JS value.
        const scalar = raw => {
            let s = raw.trim();
            if (s === "" || s === "~" || s === "null") return null;
            if (s === "true") return true;
            if (s === "false") return false;
            if ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'")) {
                const inner = s.slice(1, -1);
                return s[0] === '"' ? inner.replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\\\/g, "\\") : inner.replace(/''/g, "'");
            }
            if (/^[+-]?\d+$/.test(s)) return parseInt(s, 10);
            if (/^[+-]?(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?$/.test(s)) return parseFloat(s);
            return s;
        };

        // Very small YAML subset: nested maps (key: value) and sequences (- item) by 2-space indentation.
        const parse = text => {
            const raw = text.replace(/\r\n?/g, "\n").split("\n");
            const lines = [];
            for (const ln of raw) {
                if (/^\s*#/.test(ln) || ln.trim() === "" || ln.trim() === "---") continue;
                const m = ln.match(/^(\s*)(.*)$/);
                lines.push({ indent: m[1].replace(/\t/g, "  ").length, content: m[2].replace(/\s+#.*$/, "").trimEnd() });
            }
            let idx = 0;
            const build = minIndent => {
                if (idx >= lines.length) return null;
                const first = lines[idx];
                if (first.content[0] === "-") {
                    const arr = [];
                    while (idx < lines.length && lines[idx].indent === first.indent && lines[idx].content[0] === "-") {
                        const cur = lines[idx];
                        const rest = cur.content.slice(1).replace(/^\s/, "");
                        idx++;
                        if (rest === "") { arr.push(build(cur.indent + 1)); }
                        else if (/^[^:\s][^:]*:(\s|$)/.test(rest) || /^["'].*["']:(\s|$)/.test(rest)) {
                            // inline map entry starting the item; reinterpret as its own block
                            lines.splice(idx, 0, { indent: cur.indent + 2, content: rest });
                            arr.push(build(cur.indent + 2));
                        } else { arr.push(scalar(rest)); }
                    }
                    return arr;
                }
                const obj = {};
                while (idx < lines.length && lines[idx].indent === first.indent) {
                    const cur = lines[idx];
                    const cm = cur.content.match(/^("(?:[^"\\]|\\.)*"|'[^']*'|[^:]+?):(?:\s+(.*))?$/);
                    if (!cm) throw new Error("cannot parse line: " + cur.content);
                    let key = cm[1].trim();
                    if ((key[0] === '"' && key.slice(-1) === '"')) key = key.slice(1, -1);
                    else if (key[0] === "'" && key.slice(-1) === "'") key = key.slice(1, -1);
                    const val = cm[2];
                    idx++;
                    if (val === undefined || val === "") {
                        if (idx < lines.length && lines[idx].indent > cur.indent) obj[key] = build(lines[idx].indent);
                        else obj[key] = null;
                    } else {
                        obj[key] = scalar(val);
                    }
                }
                return obj;
            };
            const result = build(0);
            return result;
        };

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:6px;height:100%">
            <div style="display:flex;gap:6px;align-items:center">
              <button id="_y2j_go" style="cursor:pointer">Convert →</button>
              <button id="_y2j_copy" style="cursor:pointer">Copy</button>
              <span id="_y2j_msg" style="color:var(--text-dim);font-size:11px"></span>
            </div>
            <textarea id="_y2j_in" spellcheck="false" placeholder="name: demo&#10;count: 3&#10;items:&#10;  - a&#10;  - b" style="flex:1;min-height:60px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
            <textarea id="_y2j_out" spellcheck="false" readonly style="flex:1;min-height:60px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
          </div>`;
        const $ = s => body.querySelector(s);
        const inp = $("#_y2j_in"), out = $("#_y2j_out"), msg = $("#_y2j_msg");

        const run = () => {
            const src = inp.value;
            if (!src.trim()) { out.value = ""; msg.textContent = ""; return; }
            try {
                const j = parse(src);
                out.value = JSON.stringify(j, null, 2);
                msg.innerHTML = `<span style="color:var(--accent2)">ok</span>`;
            } catch (e) {
                out.value = "";
                msg.innerHTML = `<span style="color:var(--danger)">${esc(e.message)} — only simple YAML supported</span>`;
            }
        };
        const copy = () => { if (out.value) { navigator.clipboard.writeText(out.value); msg.innerHTML = `<span style="color:var(--accent)">copied</span>`; } };

        inp.addEventListener("input", run);
        $("#_y2j_go").addEventListener("click", run);
        $("#_y2j_copy").addEventListener("click", copy);

        return { destroy() { inp.removeEventListener("input", run); } };
    }
};
