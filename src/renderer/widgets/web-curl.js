"use strict";
window.I18N.register({
    en: { "widget.web_curl": "cURL Builder", "cat.web": "Web / API" },
    ru: { "widget.web_curl": "Конструктор cURL", "cat.web": "Веб / API" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.web_curl = {
    id: "web_curl",
    title: "widget.web_curl",
    category: "web",
    description: "Build a curl command from method/url/headers/body",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inputCss = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:12px";
        const btnCss = "background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 10px;cursor:pointer;font-size:11px";
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
            <div style="display:flex;gap:6px;align-items:center">
              <select class="_c_m" style="${inputCss}">
                <option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option><option>HEAD</option>
              </select>
              <input class="_c_u" placeholder="https://api.example.com/endpoint" style="${inputCss};flex:1" />
            </div>
            <div style="display:flex;gap:6px;flex:1;min-height:0">
              <div style="display:flex;flex-direction:column;gap:4px;width:42%;min-height:0">
                <label style="color:var(--text-dim)">Headers (KEY: VALUE per line)</label>
                <textarea class="_c_h" spellcheck="false" placeholder="Content-Type: application/json" style="${inputCss};flex:1;resize:none"></textarea>
                <label style="color:var(--text-dim)">Body</label>
                <textarea class="_c_b" spellcheck="false" placeholder='{"key":"value"}' style="${inputCss};flex:1;resize:none"></textarea>
              </div>
              <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-height:0">
                <div style="display:flex;gap:6px;align-items:center">
                  <label style="color:var(--text-dim);flex:1">curl command</label>
                  <button class="_c_copy" style="${btnCss}">Copy</button>
                  <button class="_c_run" style="${btnCss}">Send to terminal</button>
                </div>
                <pre class="_c_out" style="${inputCss};flex:1;margin:0;overflow:auto;white-space:pre-wrap;word-break:break-word"></pre>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true;

        const shq = s => "'" + String(s).replace(/'/g, "'\\''") + "'";
        const build = () => {
            const url = $("._c_u").value.trim();
            const method = $("._c_m").value;
            const parts = ["curl"];
            if (method !== "GET") parts.push("-X " + method);
            String($("._c_h").value || "").split("\n").forEach(line => {
                const i = line.indexOf(":");
                if (i > 0) {
                    const k = line.slice(0, i).trim();
                    if (k) parts.push("-H " + shq(k + ": " + line.slice(i + 1).trim()));
                }
            });
            const b = $("._c_b").value;
            if (b && method !== "GET" && method !== "HEAD") parts.push("--data " + shq(b));
            parts.push(shq(url || "URL"));
            $("._c_out").textContent = parts.join(" \\\n  ");
        };
        ["._c_m", "._c_u", "._c_h", "._c_b"].forEach(sel => { const el = $(sel); el.addEventListener("input", build); el.addEventListener("change", build); });
        $("._c_copy").onclick = () => { const t = $("._c_out").textContent; if (t && navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {}); };
        $("._c_run").onclick = () => { const t = $("._c_out").textContent; if (t && window.term && window.term.runInFocused) window.term.runInFocused(t.replace(/\\\n\s*/g, " ") + "\n"); };
        build();

        return { destroy: () => { alive = false; } };
    }
};
