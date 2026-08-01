"use strict";
window.I18N.register({
    en: { "widget.az_vms": "Azure VMs", "cat.cloud": "Cloud" },
    ru: { "widget.az_vms": "ВМ Azure", "cat.cloud": "Облако" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.az_vms = {
    id: "az_vms",
    title: "widget.az_vms",
    category: "cloud",
    description: "Azure virtual machines: resource group, size, location, power state",
    defaultSize: { w: 12, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">🖥 VMs</span><span class="v" id="_azvm_sum">…</span></div>
            <div id="_azvm_msg" style="color:var(--text-dim);font-size:11px;margin:4px 0"></div>
            <div style="overflow:auto;max-height:100%">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px">NAME</th><th style="padding:2px 6px">RESOURCE GROUP</th>
                  <th style="padding:2px 6px">SIZE</th><th style="padding:2px 6px">LOCATION</th>
                  <th style="padding:2px 6px">POWER</th>
                </tr></thead>
                <tbody id="_azvm_rows"></tbody>
              </table>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                // -d includes powerState; project only the fields we render
                const r = await window.dyo.exec("az", ["vm", "list", "-d",
                    "--query", "[].{name:name,rg:resourceGroup,size:hardwareProfile.vmSize,loc:location,power:powerState}",
                    "-o", "json"], { timeout: 25000 });
                if (!r || r.code !== 0) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n").filter(Boolean).pop() : "az not found — install Azure CLI to enable";
                    const notLogged = err && /az login|not logged|no subscription/i.test(err);
                    $("#_azvm_msg").textContent = notLogged ? "not logged in — run: az login" : (err || "az CLI unavailable");
                    $("#_azvm_sum").textContent = "—";
                    $("#_azvm_rows").innerHTML = "";
                    return;
                }
                let arr;
                try { arr = JSON.parse(r.stdout || "[]"); } catch (e) { arr = []; }
                if (!Array.isArray(arr) || !arr.length) {
                    $("#_azvm_msg").textContent = "no VMs in this subscription";
                    $("#_azvm_sum").textContent = "0";
                    $("#_azvm_rows").innerHTML = "";
                    return;
                }
                $("#_azvm_msg").textContent = "";
                let running = 0;
                const rows = arr.slice(0, 200).map(v => {
                    const power = (v.power || "").replace(/^VM\s*/i, "");
                    const up = /running/i.test(power);
                    if (up) running++;
                    return `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:2px 6px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(v.name)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(v.rg)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(v.size)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(v.loc)}</td>
                        <td style="padding:2px 6px;color:${up ? "var(--accent2)" : "var(--text-dim)"}">${esc(power || "unknown")}</td></tr>`;
                }).join("");
                $("#_azvm_rows").innerHTML = rows;
                $("#_azvm_sum").innerHTML = `<b style="color:var(--accent2)">${running} running</b> / ${arr.length} total`;
            } catch (e) {
                $("#_azvm_msg").textContent = "error: " + esc(e && e.message);
            } finally {
                busy = false;
            }
        };
        tick();
        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
