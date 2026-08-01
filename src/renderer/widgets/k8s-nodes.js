"use strict";
window.I18N.register({
    en: { "widget.k8snodes": "K8s Nodes", "cat.kubernetes": "Kubernetes" },
    ru: { "widget.k8snodes": "K8s ноды", "cat.kubernetes": "Kubernetes" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.k8snodes = {
    id: "k8snodes",
    title: "widget.k8snodes",
    category: "kubernetes",
    description: "Cluster nodes: status, roles, version",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">🖥 NODES</span><span class="v" id="_k8n_sum">…</span></div>
            <div id="_k8n_msg" style="color:var(--text-dim);font-size:11px;margin:4px 0"></div>
            <div style="overflow:auto;max-height:100%">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px">NAME</th><th style="padding:2px 6px">STATUS</th>
                  <th style="padding:2px 6px">ROLES</th><th style="padding:2px 6px">VERSION</th>
                </tr></thead>
                <tbody id="_k8n_rows"></tbody>
              </table>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const kc = (args) => window.dyo.exec("kubectl", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 8000 });

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const r = await kc(["get", "nodes", "-o", "wide", "--no-headers"]);
                if (!r || r.code !== 0) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n")[0] : "kubectl not found — install to enable";
                    $("#_k8n_msg").textContent = err;
                    $("#_k8n_sum").textContent = "—";
                    $("#_k8n_rows").innerHTML = "";
                    return;
                }
                $("#_k8n_msg").textContent = "";
                const lines = (r.stdout || "").split("\n").map(l => l.trim()).filter(Boolean).slice(0, 200);
                if (!lines.length) {
                    $("#_k8n_sum").textContent = "no nodes";
                    $("#_k8n_rows").innerHTML = "";
                    return;
                }
                let notReady = 0;
                const rows = lines.map(l => {
                    const c = l.split(/\s+/);
                    // NAME STATUS ROLES AGE VERSION ...
                    const name = c[0], status = c[1] || "", roles = c[2] || "<none>", version = c[4] || "";
                    const ready = status === "Ready";
                    if (!ready) notReady++;
                    return `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:2px 6px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</td>
                        <td style="padding:2px 6px;color:${ready ? "var(--accent2)" : "var(--danger)"}">${esc(status)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(roles)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(version)}</td></tr>`;
                }).join("");
                $("#_k8n_rows").innerHTML = rows;
                $("#_k8n_sum").innerHTML = notReady > 0
                    ? `<b style="color:var(--danger)">${notReady} not ready</b> / ${lines.length}`
                    : `<b style="color:var(--accent2)">${lines.length} ready</b>`;
            } catch (e) {
                $("#_k8n_msg").textContent = "error: " + esc(e && e.message);
            } finally {
                busy = false;
            }
        };
        tick();
        const iv = setInterval(tick, 5000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
