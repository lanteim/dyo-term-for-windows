"use strict";
window.I18N.register({
    en: { "widget.k8x_hpa": "K8s HPA", "cat.kubernetes": "Kubernetes" },
    ru: { "widget.k8x_hpa": "K8s HPA", "cat.kubernetes": "Kubernetes" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.k8x_hpa = {
    id: "k8x_hpa",
    title: "widget.k8x_hpa",
    category: "kubernetes",
    description: "Horizontal Pod Autoscalers with targets and replicas",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">📈 HPA</span><span class="v" id="_kh_sum">…</span></div>
            <div id="_kh_msg" style="color:var(--text-dim);font-size:11px;margin:4px 0"></div>
            <div style="overflow:auto;max-height:100%">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px">NAMESPACE</th><th style="padding:2px 6px">NAME</th>
                  <th style="padding:2px 6px">TARGETS</th><th style="padding:2px 6px">MIN/MAX</th>
                  <th style="padding:2px 6px">REPLICAS</th>
                </tr></thead>
                <tbody id="_kh_rows"></tbody>
              </table>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const kc = (args) => window.dyo.exec("kubectl", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 8000 });

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const r = await kc(["get", "hpa", "-A", "--no-headers"]);
                if (!alive) return;
                if (!r || r.code !== 0) {
                    $("#_kh_msg").textContent = (r && r.stderr ? r.stderr.trim().split("\n")[0] : "kubectl not found — install to enable");
                    $("#_kh_sum").textContent = "—";
                    $("#_kh_rows").innerHTML = "";
                    return;
                }
                $("#_kh_msg").textContent = "";
                const lines = r.stdout.split("\n").map(l => l.trim()).filter(Boolean).slice(0, 200);
                if (!lines.length) { $("#_kh_sum").textContent = "no HPA defined"; $("#_kh_rows").innerHTML = ""; return; }
                let maxed = 0;
                const rows = lines.map(l => {
                    const c = l.split(/\s+/);
                    // ns name reference targets minpods maxpods replicas age
                    const ns = c[0], name = c[1], targets = c[3] || "", minp = c[4] || "", maxp = c[5] || "", reps = c[6] || "";
                    if (reps && maxp && reps === maxp) maxed++;
                    const rc = (reps && maxp && reps === maxp) ? "var(--danger)" : "var(--accent2)";
                    return `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(ns)}</td>
                        <td style="padding:2px 6px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</td>
                        <td style="padding:2px 6px;color:var(--accent)">${esc(targets)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(minp)}/${esc(maxp)}</td>
                        <td style="padding:2px 6px;color:${rc}">${esc(reps)}</td></tr>`;
                }).join("");
                $("#_kh_rows").innerHTML = rows;
                $("#_kh_sum").innerHTML = `<b>${lines.length}</b> HPA${maxed ? ` · <span style="color:var(--danger)">${maxed} at max</span>` : ""}`;
            } catch (e) {
                if (alive) $("#_kh_msg").textContent = "error: " + esc(e && e.message);
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 5000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
