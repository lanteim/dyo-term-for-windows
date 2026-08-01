"use strict";
window.I18N.register({
    en: { "widget.helm": "Helm Releases", "cat.kubernetes": "Kubernetes" },
    ru: { "widget.helm": "Helm релизы", "cat.kubernetes": "Kubernetes" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.helm = {
    id: "helm",
    title: "widget.helm",
    category: "kubernetes",
    description: "Helm releases across all namespaces",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">⎈ HELM</span><span class="v" id="_hlm_sum">…</span></div>
            <div id="_hlm_msg" style="color:var(--text-dim);font-size:11px;margin:4px 0"></div>
            <div style="overflow:auto;max-height:100%">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px">NAME</th><th style="padding:2px 6px">NS</th>
                  <th style="padding:2px 6px">REV</th><th style="padding:2px 6px">STATUS</th>
                </tr></thead>
                <tbody id="_hlm_rows"></tbody>
              </table>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const helm = (args) => window.dyo.exec("helm", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 8000 });

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                // helm list -A -o json for robust parsing
                const r = await helm(["list", "-A", "-o", "json"]);
                if (!r || r.code !== 0) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n")[0] : "helm not found — install to enable";
                    $("#_hlm_msg").textContent = err;
                    $("#_hlm_sum").textContent = "—";
                    $("#_hlm_rows").innerHTML = "";
                    return;
                }
                $("#_hlm_msg").textContent = "";
                let arr = [];
                try { arr = JSON.parse(r.stdout || "[]"); } catch (e) { arr = []; }
                if (!Array.isArray(arr) || !arr.length) {
                    $("#_hlm_sum").textContent = "no releases";
                    $("#_hlm_rows").innerHTML = "";
                    return;
                }
                arr = arr.slice(0, 200);
                let bad = 0;
                const rows = arr.map(rel => {
                    const name = rel.name || "", ns = rel.namespace || "", rev = rel.revision || "", status = rel.status || "";
                    const ok = status === "deployed";
                    if (!ok) bad++;
                    return `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:2px 6px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(ns)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(rev)}</td>
                        <td style="padding:2px 6px;color:${ok ? "var(--accent2)" : "var(--danger)"}">${esc(status)}</td></tr>`;
                }).join("");
                $("#_hlm_rows").innerHTML = rows;
                $("#_hlm_sum").innerHTML = bad > 0
                    ? `<b style="color:var(--danger)">${bad} not deployed</b> / ${arr.length}`
                    : `<b style="color:var(--accent2)">${arr.length} deployed</b>`;
            } catch (e) {
                $("#_hlm_msg").textContent = "error: " + esc(e && e.message);
            } finally {
                busy = false;
            }
        };
        tick();
        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
