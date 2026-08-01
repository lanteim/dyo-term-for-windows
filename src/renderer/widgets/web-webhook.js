"use strict";
window.I18N.register({
    en: { "widget.web_webhook": "Request Inspector", "cat.web": "Web / API" },
    ru: { "widget.web_webhook": "Инспектор запросов", "cat.web": "Веб / API" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.web_webhook = {
    id: "web_webhook",
    title: "widget.web_webhook",
    category: "web",
    description: "Send a test request to a URL and inspect the response",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inputCss = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:12px";
        const btnCss = "background:var(--accent);color:#000;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:12px;font-weight:600";
        const gbtn = "background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 10px;cursor:pointer;font-size:11px";
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
            <div style="display:flex;gap:6px;align-items:center">
              <select class="_k_m" style="${inputCss}"><option>POST</option><option>GET</option><option>PUT</option></select>
              <input class="_k_u" placeholder="http://localhost:3000/webhook" style="${inputCss};flex:1" />
              <button class="_k_sample" style="${gbtn}">Sample</button>
              <button class="_k_send" style="${btnCss}">Send test</button>
            </div>
            <label style="color:var(--text-dim)">Test payload (JSON)</label>
            <textarea class="_k_b" spellcheck="false" style="${inputCss};height:70px;resize:none"></textarea>
            <div class="_k_status" style="color:var(--text-dim);min-height:16px">Send a test request to inspect the response.</div>
            <pre class="_k_out" style="${inputCss};flex:1;margin:0;overflow:auto;white-space:pre-wrap;word-break:break-word"></pre>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;

        const sample = () => JSON.stringify({ event: "test", id: (crypto.randomUUID ? crypto.randomUUID() : Date.now()), ts: new Date().toISOString(), source: "dyo-term" }, null, 2);
        $("._k_b").value = sample();
        $("._k_sample").onclick = () => { $("._k_b").value = sample(); };

        const send = async () => {
            if (busy) return;
            const url = $("._k_u").value.trim();
            if (!url) { $("._k_status").innerHTML = `<span style="color:var(--danger)">Enter a target URL</span>`; return; }
            const method = $("._k_m").value;
            const opts = { method, headers: { "Content-Type": "application/json" }, timeout: 12000 };
            if (method !== "GET") opts.body = $("._k_b").value;
            busy = true; $("._k_send").disabled = true; $("._k_status").textContent = "Sending…"; $("._k_out").textContent = "";
            const t0 = performance.now();
            let r;
            try { r = await window.dyo.http(url, opts); }
            catch (e) { if (alive) $("._k_status").innerHTML = `<span style="color:var(--danger)">Error: ${esc(e && e.message)}</span>`; busy = false; $("._k_send").disabled = false; return; }
            if (!alive) return;
            busy = false; $("._k_send").disabled = false;
            const ms = Math.round(performance.now() - t0);
            if (!r || r.error) {
                $("._k_status").innerHTML = `<span style="color:var(--danger)">${esc((r && r.error) || "no response — is the listener running?")}</span> · ${ms}ms`;
                $("._k_out").textContent = "Tip: start a local listener, e.g.\n  nc -l 3000\n  python3 -m http.server 3000";
                return;
            }
            $("._k_status").innerHTML = `<b style="color:${r.ok ? "var(--accent)" : "var(--danger)"}">${esc(r.status)}</b> · ${ms}ms · ${esc((r.text || "").length)} bytes`;
            let out = r.text || "(empty response body)";
            try { out = JSON.stringify(JSON.parse(out), null, 2); } catch (e) { /* raw */ }
            $("._k_out").textContent = out;
        };
        $("._k_send").onclick = send;

        return { destroy: () => { alive = false; } };
    }
};
