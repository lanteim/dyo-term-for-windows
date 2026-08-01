"use strict";
window.I18N.register({
    en: { "widget.k8x_deployments": "K8s Deployments", "cat.kubernetes": "Kubernetes" },
    ru: { "widget.k8x_deployments": "K8s деплойменты", "cat.kubernetes": "Kubernetes" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.k8x_deployments = {
    id: "k8x_deployments",
    title: "widget.k8x_deployments",
    category: "kubernetes",
    description: "Deployments across all namespaces with ready state",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">🚀 DEPLOYMENTS</span><span class="v" id="_kd_sum">…</span></div>
            <div id="_kd_msg" style="color:var(--text-dim);font-size:11px;margin:4px 0"></div>
            <div style="overflow:auto;max-height:100%">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px">NAMESPACE</th><th style="padding:2px 6px">NAME</th>
                  <th style="padding:2px 6px">READY</th><th style="padding:2px 6px">AVAIL</th>
                  <th style="padding:2px 6px">AGE</th>
                </tr></thead>
                <tbody id="_kd_rows"></tbody>
              </table>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const kc = (args) => window.dyo.exec("kubectl", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 8000 });

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const r = await kc(["get", "deploy", "-A", "--no-headers"]);
                if (!alive) return;
                if (!r || r.code !== 0) {
                    $("#_kd_msg").textContent = (r && r.stderr ? r.stderr.trim().split("\n")[0] : "kubectl not found — install to enable");
                    $("#_kd_sum").textContent = "—";
                    $("#_kd_rows").innerHTML = "";
                    return;
                }
                $("#_kd_msg").textContent = "";
                const lines = r.stdout.split("\n").map(l => l.trim()).filter(Boolean).slice(0, 200);
                if (!lines.length) { $("#_kd_sum").textContent = "no deployments"; $("#_kd_rows").innerHTML = ""; return; }
                let bad = 0;
                const rows = lines.map(l => {
                    const c = l.split(/\s+/);
                    const ns = c[0], name = c[1], ready = c[2] || "", avail = c[4] || "", age = c[5] || "";
                    let rok = false;
                    if (ready.indexOf("/") > -1) { const p = ready.split("/"); rok = p[0] === p[1] && p[1] !== "0"; }
                    if (!rok) bad++;
                    return `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(ns)}</td>
                        <td style="padding:2px 6px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</td>
                        <td style="padding:2px 6px;color:${rok ? "var(--accent2)" : "var(--danger)"}">${esc(ready)}</td>
                        <td style="padding:2px 6px">${esc(avail)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(age)}</td></tr>`;
                }).join("");
                $("#_kd_rows").innerHTML = rows;
                const total = lines.length;
                $("#_kd_sum").innerHTML = bad > 0
                    ? `<b style="color:var(--danger)">${bad} not ready</b> / ${total} total`
                    : `<b style="color:var(--accent2)">all ${total} ready</b>`;
            } catch (e) {
                if (alive) $("#_kd_msg").textContent = "error: " + esc(e && e.message);
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 5000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
