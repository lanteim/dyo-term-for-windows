"use strict";
window.I18N.register({
    en: { "widget.k8x_pvc": "K8s PVC", "cat.kubernetes": "Kubernetes" },
    ru: { "widget.k8x_pvc": "K8s PVC", "cat.kubernetes": "Kubernetes" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.k8x_pvc = {
    id: "k8x_pvc",
    title: "widget.k8x_pvc",
    category: "kubernetes",
    description: "PersistentVolumeClaims across all namespaces",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">💾 PVC</span><span class="v" id="_kp_sum">…</span></div>
            <div id="_kp_msg" style="color:var(--text-dim);font-size:11px;margin:4px 0"></div>
            <div style="overflow:auto;max-height:100%">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px">NAMESPACE</th><th style="padding:2px 6px">NAME</th>
                  <th style="padding:2px 6px">STATUS</th><th style="padding:2px 6px">CAPACITY</th>
                  <th style="padding:2px 6px">STORAGECLASS</th>
                </tr></thead>
                <tbody id="_kp_rows"></tbody>
              </table>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const kc = (args) => window.dyo.exec("kubectl", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 8000 });

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const r = await kc(["get", "pvc", "-A", "--no-headers"]);
                if (!alive) return;
                if (!r || r.code !== 0) {
                    $("#_kp_msg").textContent = (r && r.stderr ? r.stderr.trim().split("\n")[0] : "kubectl not found — install to enable");
                    $("#_kp_sum").textContent = "—";
                    $("#_kp_rows").innerHTML = "";
                    return;
                }
                $("#_kp_msg").textContent = "";
                const lines = r.stdout.split("\n").map(l => l.trim()).filter(Boolean).slice(0, 200);
                if (!lines.length) { $("#_kp_sum").textContent = "no PVCs"; $("#_kp_rows").innerHTML = ""; return; }
                let bad = 0;
                const rows = lines.map(l => {
                    const c = l.split(/\s+/);
                    // ns name status volume capacity accessmodes storageclass age
                    const ns = c[0], name = c[1], status = c[2] || "", cap = c[4] || "", sc = c[6] || "";
                    const bound = status === "Bound";
                    if (!bound) bad++;
                    return `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(ns)}</td>
                        <td style="padding:2px 6px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</td>
                        <td style="padding:2px 6px;color:${bound ? "var(--accent2)" : "var(--danger)"}">${esc(status)}</td>
                        <td style="padding:2px 6px">${esc(cap)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(sc)}</td></tr>`;
                }).join("");
                $("#_kp_rows").innerHTML = rows;
                $("#_kp_sum").innerHTML = bad > 0
                    ? `<b style="color:var(--danger)">${bad} unbound</b> / ${lines.length} total`
                    : `<b style="color:var(--accent2)">all ${lines.length} bound</b>`;
            } catch (e) {
                if (alive) $("#_kp_msg").textContent = "error: " + esc(e && e.message);
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
