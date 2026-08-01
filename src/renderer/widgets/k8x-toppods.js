"use strict";
window.I18N.register({
    en: { "widget.k8x_toppods": "K8s Top Pods", "cat.kubernetes": "Kubernetes" },
    ru: { "widget.k8x_toppods": "K8s топ подов", "cat.kubernetes": "Kubernetes" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.k8x_toppods = {
    id: "k8x_toppods",
    title: "widget.k8x_toppods",
    category: "kubernetes",
    description: "Pod CPU / memory usage from metrics-server",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">📊 TOP PODS</span><span class="v" id="_kt_sum">…</span></div>
            <div id="_kt_msg" style="color:var(--text-dim);font-size:11px;margin:4px 0"></div>
            <div style="overflow:auto;max-height:100%">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px">NAMESPACE</th><th style="padding:2px 6px">NAME</th>
                  <th style="padding:2px 6px;text-align:right">CPU</th><th style="padding:2px 6px;text-align:right">MEM</th>
                </tr></thead>
                <tbody id="_kt_rows"></tbody>
              </table>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const kc = (args) => window.dyo.exec("kubectl", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 9000 });
        const cpuNum = v => { const m = /^(\d+)/.exec(v || ""); return m ? parseInt(m[1], 10) : 0; };
        const memNum = v => { const m = /^(\d+)/.exec(v || ""); return m ? parseInt(m[1], 10) : 0; };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const r = await kc(["top", "pods", "-A", "--no-headers"]);
                if (!alive) return;
                if (!r || r.code !== 0) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n")[0] : "kubectl not found";
                    const friendly = /metrics|Metrics|not available|ServerNotFound|could not find/.test(err)
                        ? "metrics-server unavailable — install it to see pod usage"
                        : err;
                    $("#_kt_msg").textContent = friendly;
                    $("#_kt_sum").textContent = "—";
                    $("#_kt_rows").innerHTML = "";
                    return;
                }
                $("#_kt_msg").textContent = "";
                let lines = (r.stdout || "").split("\n").map(l => l.trim()).filter(Boolean);
                if (!lines.length) { $("#_kt_sum").textContent = "no data"; $("#_kt_rows").innerHTML = ""; return; }
                const parsed = lines.map(l => {
                    const c = l.split(/\s+/);
                    return { ns: c[0], name: c[1], cpu: c[2] || "", mem: c[3] || "", c: cpuNum(c[2]), m: memNum(c[3]) };
                });
                parsed.sort((a, b) => b.c - a.c || b.m - a.m);
                const top = parsed.slice(0, 200);
                const rows = top.map(p => `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(p.ns)}</td>
                        <td style="padding:2px 6px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</td>
                        <td style="padding:2px 6px;text-align:right;color:var(--accent)">${esc(p.cpu)}</td>
                        <td style="padding:2px 6px;text-align:right;color:var(--accent2)">${esc(p.mem)}</td></tr>`).join("");
                $("#_kt_rows").innerHTML = rows;
                $("#_kt_sum").innerHTML = `<b>${parsed.length}</b> pods · top by CPU`;
            } catch (e) {
                if (alive) $("#_kt_msg").textContent = "error: " + esc(e && e.message);
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 5000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
