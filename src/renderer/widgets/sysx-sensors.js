"use strict";
window.I18N.register({
    en: { "widget.sysx_sensors": "CPU Sensors", "cat.system": "System" },
    ru: { "widget.sysx_sensors": "Датчики CPU", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    window.WIDGETS.sysx_sensors = {
        id: "sysx_sensors",
        title: "widget.sysx_sensors",
        category: "system",
        description: "CPU temperature main + per-core",
        defaultSize: { w: 6, h: 4 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🌡️ CPU TEMPERATURE</span>
                    <span id="_sxs_msg" style="color:var(--text-dim);margin-left:auto"></span>
                  </div>
                  <div class="metric-row"><span class="k">MAIN</span><span class="v"><b id="_sxs_main">—</b></span></div>
                  <div id="_sxs_cores" style="flex:1;overflow:auto;margin-top:4px"></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const col = t => t == null ? "var(--text-dim)" : (t >= 85 ? "var(--danger)" : t >= 70 ? "var(--accent2)" : "var(--accent)");
            const fmt = t => (typeof t === "number" && t > 0) ? Math.round(t) + "°C" : "n/a";

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const temp = await window.dyo.si("cpuTemperature");
                    if (!temp) { $("#_sxs_msg").textContent = "unavailable"; return; }
                    const main = temp.main;
                    const cores = Array.isArray(temp.cores) ? temp.cores.filter(c => typeof c === "number" && c > 0) : [];
                    const hasMain = typeof main === "number" && main > 0;
                    if (!hasMain && cores.length === 0) {
                        $("#_sxs_msg").textContent = "";
                        $("#_sxs_main").textContent = "n/a";
                        $("#_sxs_cores").innerHTML = `<div style="color:var(--text-dim);font-size:11px">sensors need elevated access</div>`;
                        return;
                    }
                    $("#_sxs_msg").textContent = "";
                    const m = $("#_sxs_main");
                    m.textContent = fmt(main);
                    m.style.color = col(hasMain ? main : null);
                    if (cores.length) {
                        let html = "";
                        cores.forEach((c, i) => {
                            const pct = Math.max(0, Math.min(100, Math.round((c / 100) * 100)));
                            html += `<div class="metric-row"><span class="k">core ${i}</span><span class="v" style="color:${col(c)}">${fmt(c)}</span></div>`
                                + `<div class="bar"><i style="width:${pct}%;background:${col(c)}"></i></div>`;
                        });
                        $("#_sxs_cores").innerHTML = html;
                    } else {
                        $("#_sxs_cores").innerHTML = `<div style="color:var(--text-dim);font-size:11px">no per-core data</div>`;
                    }
                } catch (e) {
                    $("#_sxs_msg").textContent = "error";
                } finally { busy = false; }
            };
            tick();
            const iv = setInterval(tick, 4000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
