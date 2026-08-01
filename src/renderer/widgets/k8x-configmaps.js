"use strict";
window.I18N.register({
    en: { "widget.k8x_configmaps": "K8s ConfigMaps", "cat.kubernetes": "Kubernetes" },
    ru: { "widget.k8x_configmaps": "K8s конфигмапы", "cat.kubernetes": "Kubernetes" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.k8x_configmaps = {
    id: "k8x_configmaps",
    title: "widget.k8x_configmaps",
    category: "kubernetes",
    description: "ConfigMaps across all namespaces (names and key counts)",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">🗂 CONFIGMAPS</span><span class="v" id="_kc_sum">…</span></div>
            <div id="_kc_msg" style="color:var(--text-dim);font-size:11px;margin:4px 0"></div>
            <div style="overflow:auto;max-height:100%">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px">NAMESPACE</th><th style="padding:2px 6px">NAME</th>
                  <th style="padding:2px 6px">KEYS</th><th style="padding:2px 6px">AGE</th>
                </tr></thead>
                <tbody id="_kc_rows"></tbody>
              </table>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const kc = (args) => window.dyo.exec("kubectl", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 8000 });

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const r = await kc(["get", "cm", "-A", "--no-headers"]);
                if (!alive) return;
                if (!r || r.code !== 0) {
                    $("#_kc_msg").textContent = (r && r.stderr ? r.stderr.trim().split("\n")[0] : "kubectl not found — install to enable");
                    $("#_kc_sum").textContent = "—";
                    $("#_kc_rows").innerHTML = "";
                    return;
                }
                $("#_kc_msg").textContent = "";
                const lines = r.stdout.split("\n").map(l => l.trim()).filter(Boolean).slice(0, 200);
                if (!lines.length) { $("#_kc_sum").textContent = "no configmaps"; $("#_kc_rows").innerHTML = ""; return; }
                const rows = lines.map(l => {
                    const c = l.split(/\s+/);
                    const ns = c[0], name = c[1], data = c[2] || "", age = c[3] || "";
                    return `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(ns)}</td>
                        <td style="padding:2px 6px;max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</td>
                        <td style="padding:2px 6px;color:var(--accent2)">${esc(data)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(age)}</td></tr>`;
                }).join("");
                $("#_kc_rows").innerHTML = rows;
                $("#_kc_sum").innerHTML = `<b>${lines.length}</b> configmaps`;
            } catch (e) {
                if (alive) $("#_kc_msg").textContent = "error: " + esc(e && e.message);
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
