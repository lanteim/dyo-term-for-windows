"use strict";
window.I18N.register({
    en: { "widget.k8x_ingress": "K8s Ingress", "cat.kubernetes": "Kubernetes" },
    ru: { "widget.k8x_ingress": "K8s ингрессы", "cat.kubernetes": "Kubernetes" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.k8x_ingress = {
    id: "k8x_ingress",
    title: "widget.k8x_ingress",
    category: "kubernetes",
    description: "Ingress rules across all namespaces with hosts",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">🌐 INGRESS</span><span class="v" id="_ki_sum">…</span></div>
            <div id="_ki_msg" style="color:var(--text-dim);font-size:11px;margin:4px 0"></div>
            <div style="overflow:auto;max-height:100%">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px">NAMESPACE</th><th style="padding:2px 6px">NAME</th>
                  <th style="padding:2px 6px">CLASS</th><th style="padding:2px 6px">HOSTS</th>
                  <th style="padding:2px 6px">ADDRESS</th>
                </tr></thead>
                <tbody id="_ki_rows"></tbody>
              </table>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const kc = (args) => window.dyo.exec("kubectl", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 8000 });

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const r = await kc(["get", "ingress", "-A", "--no-headers"]);
                if (!alive) return;
                if (!r || r.code !== 0) {
                    $("#_ki_msg").textContent = (r && r.stderr ? r.stderr.trim().split("\n")[0] : "kubectl not found — install to enable");
                    $("#_ki_sum").textContent = "—";
                    $("#_ki_rows").innerHTML = "";
                    return;
                }
                $("#_ki_msg").textContent = "";
                const lines = (r.stdout || "").split("\n").map(l => l.trim()).filter(Boolean).slice(0, 200);
                if (!lines.length) { $("#_ki_sum").textContent = "no ingress"; $("#_ki_rows").innerHTML = ""; return; }
                const rows = lines.map(l => {
                    const c = l.split(/\s+/);
                    const ns = c[0], name = c[1], cls = c[2] || "", hosts = c[3] || "", addr = c[4] || "";
                    const host = hosts.split(",")[0];
                    return `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(ns)}</td>
                        <td style="padding:2px 6px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(cls)}</td>
                        <td style="padding:2px 6px;color:var(--accent2);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(hosts)}">${esc(host)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(addr)}</td></tr>`;
                }).join("");
                $("#_ki_rows").innerHTML = rows;
                $("#_ki_sum").innerHTML = `<b>${lines.length}</b> ingress`;
            } catch (e) {
                if (alive) $("#_ki_msg").textContent = "error: " + esc(e && e.message);
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 5000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
