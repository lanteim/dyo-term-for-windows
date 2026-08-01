"use strict";
window.I18N.register({
    en: { "widget.txt_xmlformat": "XML Formatter", "cat.tools": "Tools" },
    ru: { "widget.txt_xmlformat": "Форматтер XML", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.txt_xmlformat = {
    id: "txt_xmlformat",
    title: "widget.txt_xmlformat",
    category: "tools",
    description: "Pretty-print XML via DOMParser with indentation (client-side)",
    defaultSize: { w: 8, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

        const format = xml => {
            const doc = new DOMParser().parseFromString(xml, "application/xml");
            const perr = doc.querySelector("parsererror");
            if (perr) throw new Error((perr.textContent || "parse error").split("\n")[0].trim());

            const lines = [];
            const walk = (node, depth) => {
                const pad = "  ".repeat(depth);
                node.childNodes.forEach(ch => {
                    if (ch.nodeType === 1) { // element
                        const el = ch;
                        const attrs = Array.from(el.attributes || []).map(a => `${a.name}="${a.value}"`).join(" ");
                        const open = attrs ? `<${el.nodeName} ${attrs}` : `<${el.nodeName}`;
                        const kids = Array.from(el.childNodes);
                        const onlyText = kids.length && kids.every(k => k.nodeType === 3 || k.nodeType === 4);
                        if (kids.length === 0) { lines.push(pad + open + "/>"); return; }
                        if (onlyText) {
                            const txt = kids.map(k => k.nodeValue).join("").trim();
                            if (txt === "") { lines.push(pad + open + "/>"); return; }
                            lines.push(pad + open + ">" + esc(txt) + `</${el.nodeName}>`);
                            return;
                        }
                        lines.push(pad + open + ">");
                        walk(el, depth + 1);
                        lines.push(pad + `</${el.nodeName}>`);
                    } else if (ch.nodeType === 8) { // comment
                        lines.push(pad + "<!--" + ch.nodeValue + "-->");
                    } else if (ch.nodeType === 7) { // processing instruction
                        lines.push(pad + `<?${ch.target} ${ch.data}?>`);
                    } else if (ch.nodeType === 3) {
                        const t = ch.nodeValue.trim();
                        if (t) lines.push(pad + esc(t));
                    }
                });
            };
            // XML declaration if present
            if (/^\s*<\?xml/i.test(xml)) {
                const m = xml.match(/^\s*(<\?xml[^>]*\?>)/i);
                if (m) lines.push(m[1]);
            }
            walk(doc, 0);
            return lines.join("\n");
        };

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:6px;height:100%">
            <div style="display:flex;gap:6px;align-items:center">
              <button id="_xml_go" style="cursor:pointer">Format →</button>
              <button id="_xml_copy" style="cursor:pointer">Copy</button>
              <span id="_xml_msg" style="color:var(--text-dim);font-size:11px"></span>
            </div>
            <textarea id="_xml_in" spellcheck="false" placeholder="<root><item id=&quot;1&quot;>a</item><item id=&quot;2&quot;>b</item></root>" style="flex:1;min-height:60px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
            <textarea id="_xml_out" spellcheck="false" readonly style="flex:1;min-height:60px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
          </div>`;
        const $ = s => body.querySelector(s);
        const inp = $("#_xml_in"), out = $("#_xml_out"), msg = $("#_xml_msg");

        const run = () => {
            const src = inp.value;
            if (!src.trim()) { out.value = ""; msg.textContent = ""; return; }
            try { out.value = format(src); msg.innerHTML = `<span style="color:var(--accent2)">ok</span>`; }
            catch (e) { out.value = ""; msg.innerHTML = `<span style="color:var(--danger)">${esc(e.message)}</span>`; }
        };
        const copy = () => { if (out.value) { navigator.clipboard.writeText(out.value); msg.innerHTML = `<span style="color:var(--accent)">copied</span>`; } };

        inp.addEventListener("input", run);
        $("#_xml_go").addEventListener("click", run);
        $("#_xml_copy").addEventListener("click", copy);

        return { destroy() { inp.removeEventListener("input", run); } };
    }
};
