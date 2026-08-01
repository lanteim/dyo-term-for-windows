"use strict";
window.I18N.register({
    en: { "widget.ci_argocd": "Argo CD", "cat.cicd": "CI/CD" },
    ru: { "widget.ci_argocd": "Argo CD", "cat.cicd": "CI/CD" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.ci_argocd = {
    id: "ci_argocd",
    title: "widget.ci_argocd",
    category: "cicd",
    description: "Argo CD applications sync & health status",
    defaultSize: { w: 8, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div id="_ar_cfg" style="display:none;flex-direction:column;gap:6px">
              <input id="_ar_url" placeholder="https://argocd.example.com" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <input id="_ar_token" type="password" placeholder="API bearer token" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <button id="_ar_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px">Save</button>
            </div>
            <div id="_ar_main" style="display:none;flex-direction:column;gap:6px;height:100%">
              <div class="metric-row"><span class="k">🐙 Apps</span><span class="v" id="_ar_sum">…</span></div>
              <div style="overflow:auto;flex:1">
                <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                  <thead><tr style="color:var(--text-dim);text-align:left">
                    <th style="padding:2px 6px">APP</th><th style="padding:2px 6px">SYNC</th>
                    <th style="padding:2px 6px">HEALTH</th><th style="padding:2px 6px">PROJECT</th>
                  </tr></thead>
                  <tbody id="_ar_rows"></tbody>
                </table>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto">
                <span id="_ar_meta" style="color:var(--text-dim);font-size:11px"></span>
                <button id="_ar_edit" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">⚙</button>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        let url = "", token = "";
        const base = () => url.replace(/\/+$/, "");
        const showCfg = show => { $("#_ar_cfg").style.display = show ? "flex" : "none"; $("#_ar_main").style.display = show ? "none" : "flex"; };

        const syncCol = s => s === "Synced" ? "var(--accent2)" : (s === "OutOfSync" ? "var(--accent)" : "var(--text-dim)");
        const healthCol = h => {
            if (h === "Healthy") return "var(--accent2)";
            if (h === "Degraded" || h === "Missing") return "var(--danger)";
            if (h === "Progressing" || h === "Suspended") return "var(--accent)";
            return "var(--text-dim)";
        };

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            url = (s && s["ci.argocd.url"]) || "";
            token = (s && s["ci.argocd.token"]) || "";
            $("#_ar_url").value = url; $("#_ar_token").value = token;
            if (!url || !token) showCfg(true); else { showCfg(false); tick(); }
        });

        $("#_ar_save").onclick = async () => {
            url = $("#_ar_url").value.trim();
            token = $("#_ar_token").value.trim();
            await window.dyo.settings.set({ "ci.argocd.url": url, "ci.argocd.token": token });
            if (url && token) { showCfg(false); tick(); }
        };
        $("#_ar_edit").onclick = () => showCfg(true);

        const tick = async () => {
            if (!alive || busy || !url || !token) return;
            busy = true;
            $("#_ar_meta").textContent = "polling…";
            try {
                const r = await window.dyo.http(base() + "/api/v1/applications", { headers: { Authorization: "Bearer " + token }, timeout: 9000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_ar_sum").textContent = "—";
                    $("#_ar_rows").innerHTML = `<tr><td colspan="4" style="padding:4px 6px;color:var(--danger)">${esc((r && r.error) || ("HTTP " + (r && r.status)))}</td></tr>`;
                    $("#_ar_meta").textContent = "unavailable";
                    return;
                }
                let j; try { j = JSON.parse(r.text); } catch (e) { j = null; }
                const items = j && Array.isArray(j.items) ? j.items : null;
                if (!items) { $("#_ar_rows").innerHTML = `<tr><td colspan="4" style="padding:4px 6px;color:var(--danger)">unexpected response</td></tr>`; return; }
                if (!items.length) { $("#_ar_sum").textContent = "no apps"; $("#_ar_rows").innerHTML = ""; $("#_ar_meta").textContent = ""; return; }
                let synced = 0, healthy = 0;
                $("#_ar_rows").innerHTML = items.slice(0, 200).map(a => {
                    const name = (a.metadata && a.metadata.name) || "";
                    const st = a.status || {};
                    const sync = (st.sync && st.sync.status) || "Unknown";
                    const health = (st.health && st.health.status) || "Unknown";
                    const proj = (a.spec && a.spec.project) || "";
                    if (sync === "Synced") synced++;
                    if (health === "Healthy") healthy++;
                    return `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:2px 6px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(name)}">${esc(name)}</td>
                        <td style="padding:2px 6px;color:${syncCol(sync)}">${esc(sync)}</td>
                        <td style="padding:2px 6px;color:${healthCol(health)}">${esc(health)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(proj)}</td></tr>`;
                }).join("");
                $("#_ar_sum").innerHTML = `<span style="color:var(--accent2)">${synced} synced</span> / <span style="color:var(--accent2)">${healthy} healthy</span> of ${items.length}`;
                $("#_ar_meta").textContent = "updated " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) $("#_ar_rows").innerHTML = `<tr><td colspan="4" style="padding:4px 6px;color:var(--danger)">${esc(e && e.message)}</td></tr>`;
            } finally { busy = false; }
        };

        const iv = setInterval(tick, 15000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
