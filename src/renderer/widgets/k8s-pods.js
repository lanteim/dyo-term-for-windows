"use strict";
window.I18N.register({
    en: { "widget.k8spods": "K8s Pods", "cat.kubernetes": "Kubernetes" },
    ru: { "widget.k8spods": "K8s поды", "cat.kubernetes": "Kubernetes" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.k8spods = {
    id: "k8spods",
    title: "widget.k8spods",
    category: "kubernetes",
    description: "Pods in the current namespace with health summary",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">🧊 PODS</span><span class="v" id="_k8p_sum">…</span></div>
            <div id="_k8p_msg" style="color:var(--text-dim);font-size:11px;margin:4px 0"></div>
            <div style="overflow:auto;max-height:100%">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px">NAME</th><th style="padding:2px 6px">READY</th>
                  <th style="padding:2px 6px">STATUS</th><th style="padding:2px 6px">RESTARTS</th>
                  <th style="padding:2px 6px">NODE</th>
                </tr></thead>
                <tbody id="_k8p_rows"></tbody>
              </table>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const kc = (args) => window.dyo.exec("kubectl", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 8000 });

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const r = await kc(["get", "pods", "-o", "wide", "--no-headers"]);
                if (!r || r.code !== 0) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n")[0] : "kubectl not found — install to enable";
                    $("#_k8p_msg").textContent = err;
                    $("#_k8p_sum").textContent = "—";
                    $("#_k8p_rows").innerHTML = "";
                    return;
                }
                $("#_k8p_msg").textContent = "";
                const lines = r.stdout.split("\n").map(l => l.trim()).filter(Boolean).slice(0, 200);
                if (!lines.length) {
                    $("#_k8p_sum").textContent = "no pods";
                    $("#_k8p_rows").innerHTML = "";
                    return;
                }
                let bad = 0;
                const rows = lines.map(l => {
                    const c = l.split(/\s+/);
                    const name = c[0], ready = c[1] || "", status = c[2] || "", restarts = c[3] || "0", node = c[6] || "";
                    let rok = false;
                    if (ready.indexOf("/") > -1) { const p = ready.split("/"); rok = p[0] === p[1]; }
                    const running = status === "Running" || status === "Completed" || status === "Succeeded";
                    const healthy = running && rok;
                    if (!healthy) bad++;
                    const sc = healthy ? "var(--text)" : (status === "Completed" || status === "Succeeded" ? "var(--text-dim)" : "var(--danger)");
                    const rc = (parseInt(restarts, 10) || 0) > 0 ? "var(--accent)" : "var(--text-dim)";
                    return `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:2px 6px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</td>
                        <td style="padding:2px 6px;color:${rok ? "var(--accent2)" : "var(--danger)"}">${esc(ready)}</td>
                        <td style="padding:2px 6px;color:${sc}">${esc(status)}</td>
                        <td style="padding:2px 6px;color:${rc}">${esc(restarts)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(node)}</td></tr>`;
                }).join("");
                $("#_k8p_rows").innerHTML = rows;
                const total = lines.length;
                $("#_k8p_sum").innerHTML = bad > 0
                    ? `<b style="color:var(--danger)">${bad} not ready</b> / ${total} total`
                    : `<b style="color:var(--accent2)">all ${total} healthy</b>`;
            } catch (e) {
                $("#_k8p_msg").textContent = "error: " + esc(e && e.message);
            } finally {
                busy = false;
            }
        };
        tick();
        const iv = setInterval(tick, 4000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
