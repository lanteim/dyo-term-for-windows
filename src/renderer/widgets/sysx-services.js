"use strict";
window.I18N.register({
    en: { "widget.sysx_services": "LaunchD Services", "cat.system": "System" },
    ru: { "widget.sysx_services": "Службы LaunchD", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.sysx_services = {
        id: "sysx_services",
        title: "widget.sysx_services",
        category: "system",
        description: "launchctl service count & running list",
        defaultSize: { w: 6, h: 4 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">⚙️ LAUNCHCTL</span>
                    <span id="_sxsv_msg" style="color:var(--text-dim);margin-left:auto"></span>
                  </div>
                  <div class="metric-row"><span class="k">TOTAL</span><span class="v"><b id="_sxsv_total">—</b></span></div>
                  <div class="metric-row"><span class="k">RUNNING (pid)</span><span class="v" id="_sxsv_run">—</span></div>
                  <div id="_sxsv_list" style="flex:1;overflow:auto;margin-top:4px;font-family:var(--font-mono);font-size:11px"></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const res = await window.dyo.exec("launchctl", ["list"], { timeout: 8000 });
                    if (!res || res.code !== 0 || !res.stdout) {
                        $("#_sxsv_msg").textContent = "unavailable";
                        $("#_sxsv_list").innerHTML = `<div style="color:var(--text-dim)">launchctl not available</div>`;
                        return;
                    }
                    $("#_sxsv_msg").textContent = "";
                    const lines = res.stdout.split("\n").filter(l => l.trim());
                    // header: PID  Status  Label
                    const rows = lines.slice(1).map(l => {
                        const parts = l.split(/\t| {2,}/).filter(Boolean);
                        if (parts.length < 3) { const p = l.trim().split(/\s+/); return { pid: p[0], status: p[1], label: p.slice(2).join(" ") }; }
                        return { pid: parts[0], status: parts[1], label: parts.slice(2).join(" ") };
                    }).filter(r => r.label);
                    const running = rows.filter(r => r.pid && r.pid !== "-" && /^\d+$/.test(r.pid));
                    $("#_sxsv_total").textContent = rows.length;
                    $("#_sxsv_run").textContent = running.length;
                    const top = running.slice(0, 30);
                    if (!top.length) { $("#_sxsv_list").innerHTML = `<div style="color:var(--text-dim)">no running services</div>`; return; }
                    let html = "";
                    top.forEach(r => {
                        html += `<div style="display:flex;gap:8px;padding:1px 0;border-top:1px solid var(--border)">`
                            + `<span style="color:var(--accent);width:56px;text-align:right">${esc(r.pid)}</span>`
                            + `<span style="color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.label)}</span></div>`;
                    });
                    $("#_sxsv_list").innerHTML = html;
                } catch (e) {
                    $("#_sxsv_msg").textContent = "error";
                } finally { busy = false; }
            };
            tick();
            const iv = setInterval(tick, 6000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
