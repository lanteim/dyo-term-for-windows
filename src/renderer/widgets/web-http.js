"use strict";
window.I18N.register({
    en: { "widget.web_http": "HTTP Client", "cat.web": "Web / API" },
    ru: { "widget.web_http": "HTTP-клиент", "cat.web": "Веб / API" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.web_http = {
    id: "web_http",
    title: "widget.web_http",
    category: "web",
    description: "Mini Postman: method, URL, headers, body; send via dyo.http",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inputCss = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:12px";
        const btnCss = "background:var(--accent);color:#000;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:12px;font-weight:600";
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
            <div style="display:flex;gap:6px;align-items:center">
              <select class="_h_m" style="${inputCss}">
                <option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option><option>HEAD</option><option>OPTIONS</option>
              </select>
              <input class="_h_u" placeholder="https://api.example.com/endpoint" style="${inputCss};flex:1" />
              <button class="_h_send" style="${btnCss}">Send</button>
            </div>
            <div style="display:flex;gap:6px;flex:1;min-height:0">
              <div style="display:flex;flex-direction:column;gap:4px;width:38%;min-height:0">
                <label style="color:var(--text-dim)">Headers (KEY: VALUE per line)</label>
                <textarea class="_h_h" spellcheck="false" placeholder="Content-Type: application/json" style="${inputCss};flex:1;resize:none"></textarea>
                <label style="color:var(--text-dim)">Body</label>
                <textarea class="_h_b" spellcheck="false" placeholder='{"key":"value"}' style="${inputCss};flex:1;resize:none"></textarea>
              </div>
              <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-height:0">
                <div class="_h_status" style="color:var(--text-dim);min-height:16px"></div>
                <pre class="_h_out" style="${inputCss};flex:1;margin:0;overflow:auto;white-space:pre-wrap;word-break:break-word"></pre>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;

        const parseHeaders = txt => {
            const h = {};
            String(txt || "").split("\n").forEach(line => {
                const i = line.indexOf(":");
                if (i > 0) {
                    const k = line.slice(0, i).trim();
                    const v = line.slice(i + 1).trim();
                    if (k) h[k] = v;
                }
            });
            return h;
        };

        const send = async () => {
            if (busy) return;
            const url = $("._h_u").value.trim();
            if (!url) { $("._h_status").innerHTML = `<span style="color:var(--danger)">Enter a URL</span>`; return; }
            busy = true;
            $("._h_send").disabled = true;
            $("._h_status").textContent = "Sending…";
            $("._h_out").textContent = "";
            const method = $("._h_m").value;
            const headers = parseHeaders($("._h_h").value);
            const opts = { method, headers, timeout: 15000 };
            const bodyTxt = $("._h_b").value;
            if (bodyTxt && !/^(GET|HEAD)$/.test(method)) opts.body = bodyTxt;
            const t0 = performance.now();
            let r;
            try {
                r = await window.dyo.http(url, opts);
            } catch (e) {
                if (alive) $("._h_status").innerHTML = `<span style="color:var(--danger)">Error: ${esc(e && e.message)}</span>`;
                busy = false; $("._h_send").disabled = false; return;
            }
            if (!alive) return;
            const ms = Math.round(performance.now() - t0);
            $("._h_send").disabled = false;
            busy = false;
            if (!r || r.error) {
                $("._h_status").innerHTML = `<span style="color:var(--danger)">${esc((r && r.error) || "request failed")}</span> · ${ms}ms`;
                return;
            }
            const okColor = r.ok ? "var(--accent)" : "var(--danger)";
            $("._h_status").innerHTML = `<b style="color:${okColor}">${esc(r.status)}</b> · ${ms}ms · ${esc((r.text || "").length)} bytes`;
            let out = r.text || "";
            try { out = JSON.stringify(JSON.parse(out), null, 2); } catch (e) { /* not json, raw */ }
            $("._h_out").textContent = out;
        };
        $("._h_send").onclick = send;
        $("._h_u").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); send(); } });

        return { destroy: () => { alive = false; } };
    }
};
