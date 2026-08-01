"use strict";
window.I18N.register({
    en: { "widget.gcp_instances": "GCP Instances", "cat.cloud": "Cloud" },
    ru: { "widget.gcp_instances": "Инстансы GCP", "cat.cloud": "Облако" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.gcp_instances = {
    id: "gcp_instances",
    title: "widget.gcp_instances",
    category: "cloud",
    description: "Compute Engine VM instances: zone, type, status, IPs",
    defaultSize: { w: 12, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">🖥 INSTANCES</span><span class="v" id="_gci_sum">…</span></div>
            <div id="_gci_msg" style="color:var(--text-dim);font-size:11px;margin:4px 0"></div>
            <div style="overflow:auto;max-height:100%">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px">NAME</th><th style="padding:2px 6px">ZONE</th>
                  <th style="padding:2px 6px">TYPE</th><th style="padding:2px 6px">INTERNAL</th>
                  <th style="padding:2px 6px">EXTERNAL</th><th style="padding:2px 6px">STATUS</th>
                </tr></thead>
                <tbody id="_gci_rows"></tbody>
              </table>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const short = s => { s = String(s || ""); const i = s.lastIndexOf("/"); return i >= 0 ? s.slice(i + 1) : s; };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const r = await window.dyo.exec("gcloud", ["compute", "instances", "list", "--format=json", "-q"], { timeout: 20000 });
                if (!r || r.code !== 0) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n")[0] : "gcloud not found — install Google Cloud SDK to enable";
                    $("#_gci_msg").textContent = err;
                    $("#_gci_sum").textContent = "—";
                    $("#_gci_rows").innerHTML = "";
                    return;
                }
                let arr;
                try { arr = JSON.parse(r.stdout || "[]"); } catch (e) { arr = []; }
                if (!Array.isArray(arr) || !arr.length) {
                    $("#_gci_msg").textContent = "no instances in this project";
                    $("#_gci_sum").textContent = "0";
                    $("#_gci_rows").innerHTML = "";
                    return;
                }
                $("#_gci_msg").textContent = "";
                let running = 0;
                const rows = arr.slice(0, 200).map(v => {
                    const name = v.name || "";
                    const zone = short(v.zone);
                    const type = short(v.machineType);
                    const status = v.status || "";
                    const up = /RUNNING/i.test(status);
                    if (up) running++;
                    let intIp = "", extIp = "";
                    const nics = v.networkInterfaces || [];
                    if (nics[0]) {
                        intIp = nics[0].networkIP || "";
                        const ac = nics[0].accessConfigs || [];
                        if (ac[0]) extIp = ac[0].natIP || "";
                    }
                    return `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:2px 6px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(zone)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(type)}</td>
                        <td style="padding:2px 6px;text-align:right;font-variant-numeric:tabular-nums">${esc(intIp || "—")}</td>
                        <td style="padding:2px 6px;text-align:right;font-variant-numeric:tabular-nums">${esc(extIp || "—")}</td>
                        <td style="padding:2px 6px;color:${up ? "var(--accent2)" : "var(--text-dim)"}">${esc(status)}</td></tr>`;
                }).join("");
                $("#_gci_rows").innerHTML = rows;
                $("#_gci_sum").innerHTML = `<b style="color:var(--accent2)">${running} running</b> / ${arr.length} total`;
            } catch (e) {
                $("#_gci_msg").textContent = "error: " + esc(e && e.message);
            } finally {
                busy = false;
            }
        };
        tick();
        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
