"use strict";
window.I18N.register({
    en: { "widget.az_aks": "Azure AKS", "cat.cloud": "Cloud" },
    ru: { "widget.az_aks": "AKS Azure", "cat.cloud": "Облако" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.az_aks = {
    id: "az_aks",
    title: "widget.az_aks",
    category: "cloud",
    description: "Azure Kubernetes Service clusters: version, nodes, state",
    defaultSize: { w: 12, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">⎈ AKS</span><span class="v" id="_azaks_sum">…</span></div>
            <div id="_azaks_msg" style="color:var(--text-dim);font-size:11px;margin:4px 0"></div>
            <div style="overflow:auto;max-height:100%">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px">NAME</th><th style="padding:2px 6px">RESOURCE GROUP</th>
                  <th style="padding:2px 6px">LOCATION</th><th style="padding:2px 6px">VERSION</th>
                  <th style="padding:2px 6px">POWER</th><th style="padding:2px 6px">STATE</th>
                </tr></thead>
                <tbody id="_azaks_rows"></tbody>
              </table>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const r = await window.dyo.exec("az", ["aks", "list",
                    "--query", "[].{name:name,rg:resourceGroup,loc:location,ver:kubernetesVersion,power:powerState.code,state:provisioningState}",
                    "-o", "json"], { timeout: 25000 });
                if (!r || r.code !== 0) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n").filter(Boolean).pop() : "az not found — install Azure CLI to enable";
                    const notLogged = err && /az login|not logged|no subscription/i.test(err);
                    $("#_azaks_msg").textContent = notLogged ? "not logged in — run: az login" : (err || "az CLI unavailable");
                    $("#_azaks_sum").textContent = "—";
                    $("#_azaks_rows").innerHTML = "";
                    return;
                }
                let arr;
                try { arr = JSON.parse(r.stdout || "[]"); } catch (e) { arr = []; }
                if (!Array.isArray(arr) || !arr.length) {
                    $("#_azaks_msg").textContent = "no AKS clusters in this subscription";
                    $("#_azaks_sum").textContent = "0";
                    $("#_azaks_rows").innerHTML = "";
                    return;
                }
                $("#_azaks_msg").textContent = "";
                let ok = 0;
                const rows = arr.slice(0, 200).map(c => {
                    const state = c.state || "";
                    const power = c.power || "";
                    const isOk = /Succeeded/i.test(state) && /Running/i.test(power);
                    if (isOk) ok++;
                    return `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:2px 6px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(c.rg)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(c.loc)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(c.ver)}</td>
                        <td style="padding:2px 6px;color:${/Running/i.test(power) ? "var(--accent2)" : "var(--text-dim)"}">${esc(power || "—")}</td>
                        <td style="padding:2px 6px;color:${/Succeeded/i.test(state) ? "var(--accent2)" : "var(--danger)"}">${esc(state)}</td></tr>`;
                }).join("");
                $("#_azaks_rows").innerHTML = rows;
                $("#_azaks_sum").innerHTML = `<b style="color:var(--accent2)">${ok} healthy</b> / ${arr.length} total`;
            } catch (e) {
                $("#_azaks_msg").textContent = "error: " + esc(e && e.message);
            } finally {
                busy = false;
            }
        };
        tick();
        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
