"use strict";
window.I18N.register({
    en: { "widget.gke_clusters": "GKE Clusters", "cat.cloud": "Cloud" },
    ru: { "widget.gke_clusters": "Кластеры GKE", "cat.cloud": "Облако" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.gke_clusters = {
    id: "gke_clusters",
    title: "widget.gke_clusters",
    category: "cloud",
    description: "GKE clusters: location, version, nodes, status",
    defaultSize: { w: 12, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">⎈ GKE</span><span class="v" id="_gke_sum">…</span></div>
            <div id="_gke_msg" style="color:var(--text-dim);font-size:11px;margin:4px 0"></div>
            <div style="overflow:auto;max-height:100%">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px">NAME</th><th style="padding:2px 6px">LOCATION</th>
                  <th style="padding:2px 6px">VERSION</th><th style="padding:2px 6px">NODES</th>
                  <th style="padding:2px 6px">ENDPOINT</th><th style="padding:2px 6px">STATUS</th>
                </tr></thead>
                <tbody id="_gke_rows"></tbody>
              </table>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const r = await window.dyo.exec("gcloud", ["container", "clusters", "list", "--format=json", "-q"], { timeout: 20000 });
                if (!r || r.code !== 0) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n")[0] : "gcloud not found — install Google Cloud SDK to enable";
                    $("#_gke_msg").textContent = err;
                    $("#_gke_sum").textContent = "—";
                    $("#_gke_rows").innerHTML = "";
                    return;
                }
                let arr;
                try { arr = JSON.parse(r.stdout || "[]"); } catch (e) { arr = []; }
                if (!Array.isArray(arr) || !arr.length) {
                    $("#_gke_msg").textContent = "no GKE clusters in this project";
                    $("#_gke_sum").textContent = "0";
                    $("#_gke_rows").innerHTML = "";
                    return;
                }
                $("#_gke_msg").textContent = "";
                let ok = 0;
                const rows = arr.slice(0, 200).map(c => {
                    const name = c.name || "";
                    const loc = c.location || c.zone || "";
                    const ver = c.currentMasterVersion || c.initialClusterVersion || "";
                    const nodes = (c.currentNodeCount != null ? c.currentNodeCount : (c.initialNodeCount != null ? c.initialNodeCount : ""));
                    const ep = c.endpoint || "";
                    const status = c.status || "";
                    const isOk = /RUNNING/i.test(status);
                    if (isOk) ok++;
                    return `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:2px 6px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(loc)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(ver)}</td>
                        <td style="padding:2px 6px;text-align:right;font-variant-numeric:tabular-nums">${esc(String(nodes))}</td>
                        <td style="padding:2px 6px;color:var(--text-dim);font-variant-numeric:tabular-nums">${esc(ep)}</td>
                        <td style="padding:2px 6px;color:${isOk ? "var(--accent2)" : "var(--danger)"}">${esc(status)}</td></tr>`;
                }).join("");
                $("#_gke_rows").innerHTML = rows;
                $("#_gke_sum").innerHTML = `<b style="color:var(--accent2)">${ok} running</b> / ${arr.length} total`;
            } catch (e) {
                $("#_gke_msg").textContent = "error: " + esc(e && e.message);
            } finally {
                busy = false;
            }
        };
        tick();
        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
