"use strict";
window.I18N.register({
    en: { "widget.api_httpbin": "HTTP Request Tester", "cat.web": "Web" },
    ru: { "widget.api_httpbin": "HTTP тестер запросов", "cat.web": "Веб" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.api_httpbin = {
    id: "api_httpbin",
    title: "widget.api_httpbin",
    category: "web",
    description: "Send a request to any URL and see status, timing, and response size",
    defaultSize: { w: 8, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const SKEY = "api.httpbin.url";
        let alive = true, busy = false;
        const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];
        const fmtBytes = n => n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(2) + " MB";

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <select id="_hb_m" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px">${METHODS.map(m => `<option>${m}</option>`).join("")}</select>
              <input id="_hb_url" placeholder="https://httpbin.org/get" style="flex:1;min-width:150px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <button id="_hb_go" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 10px;cursor:pointer;font-family:var(--font-mono)">Send</button>
            </div>
            <details><summary style="cursor:pointer;color:var(--text-dim);font-size:11px">headers &amp; body</summary>
              <div style="display:flex;flex-direction:column;gap:4px;margin-top:4px">
                <input id="_hb_hdr" placeholder='headers JSON e.g. {"Authorization":"Bearer x"}' style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11px"/>
                <textarea id="_hb_body" placeholder="request body (for POST/PUT/PATCH)" style="height:44px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11px;resize:none"></textarea>
              </div>
            </details>
            <div id="_hb_stats" style="display:flex;gap:14px;flex-wrap:wrap"></div>
            <div id="_hb_msg" style="color:var(--text-dim);font-size:11px">Enter a URL and press Send.</div>
            <div id="_hb_out" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;font-family:var(--font-mono);font-size:11px;padding:6px;white-space:pre-wrap;word-break:break-all"></div>
          </div>`;
        const $ = s => body.querySelector(s);

        window.dyo.settings.get().then(s => { if (alive && s && s[SKEY]) $("#_hb_url").value = s[SKEY]; });

        const stat = (k, v, c) => `<div><div style="color:var(--text-dim);font-size:10px">${esc(k)}</div><div style="color:${c || "var(--text)"};font-size:15px;font-variant-numeric:tabular-nums">${esc(v)}</div></div>`;
        const codeColor = c => c < 200 ? "var(--text-dim)" : c < 300 ? "var(--accent)" : c < 400 ? "var(--accent2)" : "var(--danger)";

        const go = async () => {
            if (busy) return; busy = true;
            const url = $("#_hb_url").value.trim();
            const method = $("#_hb_m").value;
            if (!/^https?:\/\//i.test(url)) { $("#_hb_msg").innerHTML = `<span style="color:var(--danger)">enter an http(s) URL</span>`; busy = false; return; }
            window.dyo.settings.set({ [SKEY]: url });
            let headers;
            const hv = $("#_hb_hdr").value.trim();
            if (hv) { try { headers = JSON.parse(hv); } catch (e) { $("#_hb_msg").innerHTML = `<span style="color:var(--danger)">headers not valid JSON</span>`; busy = false; return; } }
            const bodyv = $("#_hb_body").value;
            const opts = { method, timeout: 20000 };
            if (headers) opts.headers = headers;
            if (bodyv && /POST|PUT|PATCH/.test(method)) opts.body = bodyv;
            $("#_hb_msg").textContent = "sending…"; $("#_hb_stats").innerHTML = "";
            const t0 = (performance && performance.now) ? performance.now() : Date.now();
            try {
                const r = await window.dyo.http(url, opts);
                const ms = Math.round(((performance && performance.now) ? performance.now() : Date.now()) - t0);
                if (!alive) return;
                if (!r || r.error) { $("#_hb_msg").innerHTML = `<span style="color:var(--danger)">request failed: ${esc(r && r.error || "no response")}</span>`; $("#_hb_out").textContent = ""; return; }
                const text = r.text || "";
                const bytes = new TextEncoder().encode(text).length;
                $("#_hb_stats").innerHTML = stat("STATUS", r.status + (r.ok ? " OK" : ""), codeColor(r.status)) + stat("TIME", ms + " ms", "var(--accent2)") + stat("SIZE", fmtBytes(bytes), "var(--accent)") + stat("METHOD", method);
                $("#_hb_msg").textContent = "";
                let disp = text;
                try { disp = JSON.stringify(JSON.parse(text), null, 2); } catch (e) { }
                $("#_hb_out").textContent = disp.length > 20000 ? disp.slice(0, 20000) + "\n… (truncated)" : disp;
            } catch (e) { if (alive) $("#_hb_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`; }
            finally { busy = false; }
        };
        $("#_hb_go").onclick = go;
        $("#_hb_url").addEventListener("keydown", e => { if (e.key === "Enter") go(); });
        return { destroy: () => { alive = false; } };
    }
};
