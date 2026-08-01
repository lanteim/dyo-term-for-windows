"use strict";
window.I18N.register({
    en: { "widget.enc2_html": "HTML Entities", "cat.tools": "Tools" },
    ru: { "widget.enc2_html": "HTML-сущности", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.enc2_html = {
    id: "enc2_html",
    title: "widget.enc2_html",
    category: "tools",
    description: "Encode/decode HTML entities, live as you type",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        let alive = true;
        const inputCss = "font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 8px;width:100%;box-sizing:border-box;resize:none";
        const btnCss = "font-family:var(--font-mono);font-size:11px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer";
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
            <div style="display:flex;gap:6px;align-items:center">
              <span style="color:var(--text-dim)">Direction</span>
              <select class="_dir" style="${inputCss};width:auto;padding:4px 6px">
                <option value="enc">Encode</option>
                <option value="dec">Decode</option>
              </select>
              <button class="_copy" style="${btnCss};margin-left:auto">Copy result</button>
            </div>
            <textarea class="_in" spellcheck="false" placeholder="Type text…" style="${inputCss};flex:1"></textarea>
            <textarea class="_out" readonly placeholder="Result…" style="${inputCss};flex:1;color:var(--accent)"></textarea>
          </div>`;
        const $ = s => body.querySelector(s);
        const named = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#039;": "'", "&#39;": "'", "&apos;": "'", "&nbsp;": " " };
        const encode = s => s.replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const decode = s => s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (full, ent) => {
            if (ent[0] === "#") {
                const cp = ent[1] === "x" || ent[1] === "X" ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
                if (isFinite(cp) && cp >= 0 && cp <= 0x10ffff) { try { return String.fromCodePoint(cp); } catch (e) { return full; } }
                return full;
            }
            return named["&" + ent + ";"] || full;
        });
        const run = () => {
            const v = $("._in").value, dir = $("._dir").value;
            $("._out").value = dir === "enc" ? encode(v) : decode(v);
        };
        $("._in").oninput = run;
        $("._dir").onchange = run;
        $("._copy").onclick = () => navigator.clipboard.writeText($("._out").value).catch(() => {});
        run();
        return { destroy: () => { alive = false; } };
    }
};
