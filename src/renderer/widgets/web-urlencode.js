"use strict";
window.I18N.register({
    en: { "widget.web_urlencode": "URL Encode", "cat.web": "Web / API" },
    ru: { "widget.web_urlencode": "URL-кодирование", "cat.web": "Веб / API" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.web_urlencode = {
    id: "web_urlencode",
    title: "widget.web_urlencode",
    category: "web",
    description: "Encode/decode URL components",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inputCss = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:12px";
        const btnCss = "background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 10px;cursor:pointer;font-size:11px";
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <button class="_u_enc" style="${btnCss}">Encode</button>
              <button class="_u_dec" style="${btnCss}">Decode</button>
              <button class="_u_encf" style="${btnCss}">Encode full URI</button>
              <button class="_u_swap" style="${btnCss}">Swap</button>
              <button class="_u_copy" style="${btnCss}">Copy out</button>
              <span class="_u_status" style="color:var(--text-dim);flex:1;text-align:right"></span>
            </div>
            <div style="display:flex;gap:6px;flex:1;min-height:0">
              <div style="display:flex;flex-direction:column;gap:3px;flex:1;min-height:0">
                <label style="color:var(--text-dim)">Input</label>
                <textarea class="_u_in" spellcheck="false" style="${inputCss};flex:1;resize:none"></textarea>
              </div>
              <div style="display:flex;flex-direction:column;gap:3px;flex:1;min-height:0">
                <label style="color:var(--text-dim)">Output</label>
                <textarea class="_u_out" spellcheck="false" readonly style="${inputCss};flex:1;resize:none"></textarea>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true;

        const run = (fn, label) => {
            try { $("._u_out").value = fn($("._u_in").value); $("._u_status").innerHTML = `<span style="color:var(--accent)">${label}</span>`; }
            catch (e) { $("._u_status").innerHTML = `<span style="color:var(--danger)">${esc(e && e.message)}</span>`; }
        };
        $("._u_enc").onclick = () => run(encodeURIComponent, "encoded");
        $("._u_dec").onclick = () => run(decodeURIComponent, "decoded");
        $("._u_encf").onclick = () => run(encodeURI, "encoded (full URI)");
        $("._u_swap").onclick = () => { const v = $("._u_out").value; $("._u_out").value = $("._u_in").value; $("._u_in").value = v; };
        $("._u_copy").onclick = () => { if ($("._u_out").value && navigator.clipboard) navigator.clipboard.writeText($("._u_out").value).catch(() => {}); };

        return { destroy: () => { alive = false; } };
    }
};
