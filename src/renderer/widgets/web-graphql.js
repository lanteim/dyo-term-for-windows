"use strict";
window.I18N.register({
    en: { "widget.web_graphql": "GraphQL", "cat.web": "Web / API" },
    ru: { "widget.web_graphql": "GraphQL", "cat.web": "Веб / API" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.web_graphql = {
    id: "web_graphql",
    title: "widget.web_graphql",
    category: "web",
    description: "Run GraphQL queries against a configured endpoint",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inputCss = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:12px";
        const btnCss = "background:var(--accent);color:#000;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:12px;font-weight:600";
        const gbtn = "background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 10px;cursor:pointer;font-size:11px";
        const cfg = { endpoint: "", headers: "" };
        let alive = true, busy = false;

        const parseHeaders = txt => {
            const h = {};
            String(txt || "").split("\n").forEach(line => {
                const i = line.indexOf(":");
                if (i > 0) { const k = line.slice(0, i).trim(); if (k) h[k] = line.slice(i + 1).trim(); }
            });
            return h;
        };

        const showConfig = () => {
            body.innerHTML = `
              <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px;justify-content:center;max-width:520px;margin:0 auto">
                <div style="color:var(--text-dim)">Configure your GraphQL endpoint</div>
                <input class="_g_ep" placeholder="https://api.example.com/graphql" value="${esc(cfg.endpoint)}" style="${inputCss}" />
                <textarea class="_g_hd" placeholder="Authorization: Bearer …&#10;(one KEY: VALUE per line)" style="${inputCss};height:70px;resize:none">${esc(cfg.headers)}</textarea>
                <button class="_g_save" style="${btnCss}">Save</button>
              </div>`;
            body.querySelector("._g_save").onclick = async () => {
                cfg.endpoint = body.querySelector("._g_ep").value.trim();
                cfg.headers = body.querySelector("._g_hd").value;
                await window.dyo.settings.set({ "graphql.endpoint": cfg.endpoint, "graphql.headers": cfg.headers });
                if (cfg.endpoint) showMain();
            };
        };

        const showMain = () => {
            body.innerHTML = `
              <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                <div style="display:flex;gap:6px;align-items:center">
                  <span style="color:var(--text-dim);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(cfg.endpoint)}</span>
                  <button class="_g_cfg" style="${gbtn}">Endpoint</button>
                  <button class="_g_run" style="${btnCss}">Run</button>
                </div>
                <div style="display:flex;gap:6px;flex:1;min-height:0">
                  <div style="display:flex;flex-direction:column;gap:4px;width:45%;min-height:0">
                    <label style="color:var(--text-dim)">Query</label>
                    <textarea class="_g_q" spellcheck="false" placeholder="query { __typename }" style="${inputCss};flex:2;resize:none"></textarea>
                    <label style="color:var(--text-dim)">Variables (JSON)</label>
                    <textarea class="_g_v" spellcheck="false" placeholder="{}" style="${inputCss};flex:1;resize:none"></textarea>
                  </div>
                  <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-height:0">
                    <div class="_g_status" style="color:var(--text-dim);min-height:16px"></div>
                    <pre class="_g_out" style="${inputCss};flex:1;margin:0;overflow:auto;white-space:pre-wrap;word-break:break-word"></pre>
                  </div>
                </div>
              </div>`;
            const $ = s => body.querySelector(s);
            $("._g_cfg").onclick = showConfig;
            const run = async () => {
                if (busy) return;
                const query = $("._g_q").value.trim();
                if (!query) { $("._g_status").innerHTML = `<span style="color:var(--danger)">Enter a query</span>`; return; }
                let variables = {};
                const vtxt = $("._g_v").value.trim();
                if (vtxt) {
                    try { variables = JSON.parse(vtxt); }
                    catch (e) { $("._g_status").innerHTML = `<span style="color:var(--danger)">Variables: ${esc(e && e.message)}</span>`; return; }
                }
                busy = true; $("._g_run").disabled = true; $("._g_status").textContent = "Running…"; $("._g_out").textContent = "";
                const headers = Object.assign({ "Content-Type": "application/json" }, parseHeaders(cfg.headers));
                const t0 = performance.now();
                let r;
                try { r = await window.dyo.http(cfg.endpoint, { method: "POST", headers, body: JSON.stringify({ query, variables }), timeout: 15000 }); }
                catch (e) { if (alive) $("._g_status").innerHTML = `<span style="color:var(--danger)">Error: ${esc(e && e.message)}</span>`; busy = false; $("._g_run").disabled = false; return; }
                if (!alive) return;
                busy = false; $("._g_run").disabled = false;
                const ms = Math.round(performance.now() - t0);
                if (!r || r.error) { $("._g_status").innerHTML = `<span style="color:var(--danger)">${esc((r && r.error) || "request failed")}</span> · ${ms}ms`; return; }
                let parsed = null;
                try { parsed = JSON.parse(r.text); } catch (e) { /* raw */ }
                if (parsed) {
                    const hasErr = parsed.errors && parsed.errors.length;
                    $("._g_status").innerHTML = `<b style="color:${r.ok && !hasErr ? "var(--accent)" : "var(--danger)"}">${esc(r.status)}</b> · ${ms}ms${hasErr ? ` · <span style="color:var(--danger)">${parsed.errors.length} error(s)</span>` : ""}`;
                    $("._g_out").textContent = JSON.stringify(parsed, null, 2);
                } else {
                    $("._g_status").innerHTML = `<b>${esc(r.status)}</b> · ${ms}ms`;
                    $("._g_out").textContent = r.text || "";
                }
            };
            $("._g_run").onclick = run;
        };

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            cfg.endpoint = (s && s["graphql.endpoint"]) || "";
            cfg.headers = (s && s["graphql.headers"]) || "";
            if (cfg.endpoint) showMain(); else showConfig();
        });

        return { destroy: () => { alive = false; } };
    }
};
