"use strict";
window.I18N.register({
    en: { "widget.web_json": "JSON Formatter", "cat.web": "Web / API" },
    ru: { "widget.web_json": "JSON-форматтер", "cat.web": "Веб / API" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.web_json = {
    id: "web_json",
    title: "widget.web_json",
    category: "web",
    description: "Validate and pretty-print JSON with collapse toggle",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inputCss = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:12px";
        const btnCss = "background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 10px;cursor:pointer;font-size:11px";
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <button class="_j_fmt" style="${btnCss}">Format</button>
              <button class="_j_min" style="${btnCss}">Minify</button>
              <button class="_j_col" style="${btnCss}">Collapse</button>
              <button class="_j_clr" style="${btnCss}">Clear</button>
              <span class="_j_status" style="color:var(--text-dim);flex:1;text-align:right"></span>
            </div>
            <div style="display:flex;gap:6px;flex:1;min-height:0">
              <textarea class="_j_in" spellcheck="false" placeholder='Paste JSON here…' style="${inputCss};flex:1;resize:none"></textarea>
              <pre class="_j_out" style="${inputCss};flex:1;margin:0;overflow:auto;white-space:pre-wrap;word-break:break-word"></pre>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, collapsed = false, lastVal = null;

        const render = () => {
            const raw = $("._j_in").value;
            if (!raw.trim()) { $("._j_out").textContent = ""; $("._j_status").textContent = ""; lastVal = null; return; }
            try {
                lastVal = JSON.parse(raw);
                $("._j_status").innerHTML = `<span style="color:var(--accent)">valid JSON</span>`;
                paint();
            } catch (e) {
                lastVal = null;
                $("._j_out").innerHTML = `<span style="color:var(--danger)">${esc(e && e.message)}</span>`;
                $("._j_status").innerHTML = `<span style="color:var(--danger)">invalid</span>`;
            }
        };
        const paint = () => {
            if (lastVal == null) return;
            if (collapsed) {
                $("._j_out").textContent = JSON.stringify(lastVal);
            } else {
                $("._j_out").textContent = JSON.stringify(lastVal, null, 2);
            }
        };
        $("._j_fmt").onclick = () => { collapsed = false; $("._j_col").textContent = "Collapse"; render(); };
        $("._j_min").onclick = () => {
            const raw = $("._j_in").value;
            try { $("._j_out").textContent = JSON.stringify(JSON.parse(raw)); $("._j_status").innerHTML = `<span style="color:var(--accent)">minified</span>`; }
            catch (e) { $("._j_out").innerHTML = `<span style="color:var(--danger)">${esc(e && e.message)}</span>`; }
        };
        $("._j_col").onclick = () => { collapsed = !collapsed; $("._j_col").textContent = collapsed ? "Expand" : "Collapse"; paint(); };
        $("._j_clr").onclick = () => { $("._j_in").value = ""; $("._j_out").textContent = ""; $("._j_status").textContent = ""; lastVal = null; };
        $("._j_in").addEventListener("input", render);

        return { destroy: () => { alive = false; } };
    }
};
