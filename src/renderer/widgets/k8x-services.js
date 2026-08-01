"use strict";
window.I18N.register({
    en: { "widget.k8x_services": "K8s Services", "cat.kubernetes": "Kubernetes" },
    ru: { "widget.k8x_services": "K8s сервисы", "cat.kubernetes": "Kubernetes" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.k8x_services = {
    id: "k8x_services",
    title: "widget.k8x_services",
    category: "kubernetes",
    description: "Services across all namespaces with type and ports",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">🔌 SERVICES</span><span class="v" id="_ks_sum">…</span></div>
            <div id="_ks_msg" style="color:var(--text-dim);font-size:11px;margin:4px 0"></div>
            <div style="overflow:auto;max-height:100%">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px">NAMESPACE</th><th style="padding:2px 6px">NAME</th>
                  <th style="padding:2px 6px">TYPE</th><th style="padding:2px 6px">CLUSTER-IP</th>
                  <th style="padding:2px 6px">EXTERNAL</th><th style="padding:2px 6px">PORTS</th>
                </tr></thead>
                <tbody id="_ks_rows"></tbody>
              </table>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const kc = (args) => window.dyo.exec("kubectl", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 8000 });

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const r = await kc(["get", "svc", "-A", "--no-headers"]);
                if (!alive) return;
                if (!r || r.code !== 0) {
                    $("#_ks_msg").textContent = (r && r.stderr ? r.stderr.trim().split("\n")[0] : "kubectl not found — install to enable");
                    $("#_ks_sum").textContent = "—";
                    $("#_ks_rows").innerHTML = "";
                    return;
                }
                $("#_ks_msg").textContent = "";
                const lines = (r.stdout || "").split("\n").map(l => l.trim()).filter(Boolean).slice(0, 200);
                if (!lines.length) { $("#_ks_sum").textContent = "no services"; $("#_ks_rows").innerHTML = ""; return; }
                let lb = 0;
                const rows = lines.map(l => {
                    const c = l.split(/\s+/);
                    const ns = c[0], name = c[1], type = c[2] || "", cip = c[3] || "", ext = c[4] || "", ports = c[5] || "";
                    if (type === "LoadBalancer") lb++;
                    const tc = type === "LoadBalancer" ? "var(--accent)" : (type === "NodePort" ? "var(--accent2)" : "var(--text)");
                    return `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(ns)}</td>
                        <td style="padding:2px 6px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</td>
                        <td style="padding:2px 6px;color:${tc}">${esc(type)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(cip)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(ext)}</td>
                        <td style="padding:2px 6px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(ports)}</td></tr>`;
                }).join("");
                $("#_ks_rows").innerHTML = rows;
                $("#_ks_sum").innerHTML = `<b>${lines.length}</b> services${lb ? ` · <span style="color:var(--accent)">${lb} LB</span>` : ""}`;
            } catch (e) {
                if (alive) $("#_ks_msg").textContent = "error: " + esc(e && e.message);
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 5000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
