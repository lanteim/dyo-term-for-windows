"use strict";
window.I18N.register({
    en: { "widget.txt_json2yaml": "JSON → YAML", "cat.tools": "Tools" },
    ru: { "widget.txt_json2yaml": "JSON → YAML", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.txt_json2yaml = {
    id: "txt_json2yaml",
    title: "widget.txt_json2yaml",
    category: "tools",
    description: "Parse JSON and emit simple YAML (client-side)",
    defaultSize: { w: 8, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

        const needQuote = s => s === "" || /^[\s#&*!|>%@`"'\-?:,\[\]{}]/.test(s) || /:\s|:\t|:$|\s#|\n/.test(s) ||
            ["true", "false", "null", "yes", "no", "~"].includes(s.toLowerCase()) || /^[+-]?(\d|\.\d)/.test(s);
        const scalar = v => {
            if (v === null) return "null";
            if (typeof v === "boolean") return v ? "true" : "false";
            if (typeof v === "number") return isFinite(v) ? String(v) : "null";
            const s = String(v);
            return needQuote(s) ? '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\t/g, "\\t") + '"' : s;
        };
        const keyStr = k => needQuote(k) ? '"' + k.replace(/"/g, '\\"') + '"' : k;

        const emit = (v, indent) => {
            const pad = "  ".repeat(indent);
            if (Array.isArray(v)) {
                if (v.length === 0) return pad + "[]\n";
                let o = "";
                for (const item of v) {
                    if (item !== null && typeof item === "object") {
                        const sub = emit(item, indent + 1);
                        // splice the dash into the first content line
                        const firstNL = sub.indexOf("\n");
                        const firstLine = sub.slice(0, firstNL);
                        o += pad + "-" + firstLine.slice(pad.length + 1) + "\n" + sub.slice(firstNL + 1);
                    } else {
                        o += pad + "- " + scalar(item) + "\n";
                    }
                }
                return o;
            }
            if (v !== null && typeof v === "object") {
                const keys = Object.keys(v);
                if (keys.length === 0) return pad + "{}\n";
                let o = "";
                for (const k of keys) {
                    const val = v[k];
                    if (val !== null && typeof val === "object" && (Array.isArray(val) ? val.length : Object.keys(val).length)) {
                        o += pad + keyStr(k) + ":\n" + emit(val, indent + 1);
                    } else if (val !== null && typeof val === "object") {
                        o += pad + keyStr(k) + ": " + (Array.isArray(val) ? "[]" : "{}") + "\n";
                    } else {
                        o += pad + keyStr(k) + ": " + scalar(val) + "\n";
                    }
                }
                return o;
            }
            return pad + scalar(v) + "\n";
        };

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:6px;height:100%">
            <div style="display:flex;gap:6px;align-items:center">
              <button id="_j2y_go" style="cursor:pointer">Convert →</button>
              <button id="_j2y_copy" style="cursor:pointer">Copy</button>
              <span id="_j2y_msg" style="color:var(--text-dim);font-size:11px"></span>
            </div>
            <textarea id="_j2y_in" spellcheck="false" placeholder='{"name":"demo","items":["a","b"]}' style="flex:1;min-height:60px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
            <textarea id="_j2y_out" spellcheck="false" readonly style="flex:1;min-height:60px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
          </div>`;
        const $ = s => body.querySelector(s);
        const inp = $("#_j2y_in"), out = $("#_j2y_out"), msg = $("#_j2y_msg");

        const run = () => {
            const src = inp.value;
            if (!src.trim()) { out.value = ""; msg.textContent = ""; return; }
            try {
                const j = JSON.parse(src);
                out.value = emit(j, 0).replace(/\n$/, "");
                msg.innerHTML = `<span style="color:var(--accent2)">ok</span>`;
            } catch (e) {
                out.value = "";
                msg.innerHTML = `<span style="color:var(--danger)">invalid JSON: ${esc(e.message)}</span>`;
            }
        };
        const copy = () => { if (out.value) { navigator.clipboard.writeText(out.value); msg.innerHTML = `<span style="color:var(--accent)">copied</span>`; } };

        inp.addEventListener("input", run);
        $("#_j2y_go").addEventListener("click", run);
        $("#_j2y_copy").addEventListener("click", copy);

        return { destroy() { inp.removeEventListener("input", run); } };
    }
};
