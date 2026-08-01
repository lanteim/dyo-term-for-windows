"use strict";
window.I18N.register({
    en: { "widget.sysx_uptime": "Uptime & OS", "cat.system": "System" },
    ru: { "widget.sysx_uptime": "Аптайм и ОС", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    const fmtUp = sec => {
        sec = Math.max(0, Math.floor(sec || 0));
        const d = Math.floor(sec / 86400);
        const h = Math.floor((sec % 86400) / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const parts = [];
        if (d) parts.push(d + "d");
        if (h || d) parts.push(h + "h");
        parts.push(m + "m");
        return parts.join(" ");
    };

    window.WIDGETS.sysx_uptime = {
        id: "sysx_uptime",
        title: "widget.sysx_uptime",
        category: "system",
        description: "system uptime, OS & kernel",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">⏱️ UPTIME</span>
                    <span id="_sxup_msg" style="color:var(--text-dim);margin-left:auto"></span>
                  </div>
                  <div class="metric-row"><span class="k">UPTIME</span><span class="v"><b id="_sxup_up">—</b></span></div>
                  <div class="metric-row"><span class="k">OS</span><span class="v" id="_sxup_os">—</span></div>
                  <div class="metric-row"><span class="k">KERNEL</span><span class="v" id="_sxup_kernel">—</span></div>
                  <div class="metric-row"><span class="k">HOST</span><span class="v" id="_sxup_host">—</span></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;
            let osShown = false;

            const loadOs = async () => {
                try {
                    const os = await window.dyo.si("osInfo");
                    if (!alive || !os) return;
                    $("#_sxup_os").textContent = [os.distro, os.release].filter(Boolean).join(" ") || os.platform || "n/a";
                    $("#_sxup_kernel").textContent = os.kernel || "n/a";
                    $("#_sxup_host").textContent = os.hostname || "n/a";
                    osShown = true;
                } catch (e) { /* leave placeholders */ }
            };

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const t = await window.dyo.si("time");
                    if (!t || typeof t.uptime !== "number") {
                        $("#_sxup_msg").textContent = "unavailable";
                    } else {
                        $("#_sxup_msg").textContent = "";
                        $("#_sxup_up").textContent = fmtUp(t.uptime);
                    }
                    if (!osShown) await loadOs();
                } catch (e) {
                    $("#_sxup_msg").textContent = "error";
                } finally { busy = false; }
            };
            tick();
            const iv = setInterval(tick, 30000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
