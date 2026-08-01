"use strict";
window.I18N.register({
    en: { "widget.ct_lima": "Lima VMs", "cat.docker": "Docker" },
    ru: { "widget.ct_lima": "Lima VMs", "cat.docker": "Docker" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.ct_lima = {
        id: "ct_lima",
        title: "widget.ct_lima",
        category: "docker",
        description: "Lima virtual machines (limactl list)",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🖥️ LIMA</span>
                    <span id="_ctlm_sum" style="color:var(--text-dim);margin-left:auto;font-variant-numeric:tabular-nums"></span>
                  </div>
                  <div id="_ctlm_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:2px"></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const diagnose = (res) => {
                const err = ((res && (res.stderr || "")) || "").toLowerCase();
                if (!res || res.code === 127 || err.includes("not found") || err.includes("command not found")) return "limactl CLI not installed";
                return "lima not available";
            };

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const res = await window.dyo.exec("limactl", ["list", "--json"], { timeout: 8000 });
                    if (!res || (res.code !== 0 && !res.stdout.trim())) {
                        $("#_ctlm_sum").textContent = "";
                        $("#_ctlm_body").innerHTML = `<div style="color:var(--text-dim);padding:10px">${esc(diagnose(res))}</div>`;
                        return;
                    }
                    const vms = [];
                    res.stdout.split("\n").forEach(l => {
                        l = l.trim();
                        if (!l) return;
                        try { vms.push(JSON.parse(l)); } catch (e) { }
                    });
                    if (!vms.length) {
                        $("#_ctlm_sum").textContent = "";
                        $("#_ctlm_body").innerHTML = `<div style="color:var(--text-dim);padding:10px">no lima instances</div>`;
                        return;
                    }
                    const run = vms.filter(v => /running/i.test(v.status || "")).length;
                    $("#_ctlm_sum").textContent = `${run}/${vms.length} running`;
                    let html = "";
                    vms.slice(0, 200).forEach(v => {
                        const r = /running/i.test(v.status || "");
                        html += `<div class="metric-row" style="padding:2px 8px">
                          <span class="k" style="color:var(--text)">${esc(v.name || "?")} <span style="color:var(--text-dim)">${esc(v.arch || "")}</span></span>
                          <span class="v" style="color:${r ? "var(--accent2)" : "var(--text-dim)"}">${esc(v.status || "?")}</span></div>`;
                    });
                    $("#_ctlm_body").innerHTML = html;
                } catch (e) {
                    $("#_ctlm_sum").textContent = "error";
                } finally { busy = false; }
            };
            tick();
            const iv = setInterval(tick, 6000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
