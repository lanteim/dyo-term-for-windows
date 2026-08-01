"use strict";
window.I18N.register({
    en: { "widget.sysx_power": "Power & Thermal", "cat.system": "System" },
    ru: { "widget.sysx_power": "Питание и нагрев", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.sysx_power = {
        id: "sysx_power",
        title: "widget.sysx_power",
        category: "system",
        description: "AC/battery source & thermal state (pmset)",
        defaultSize: { w: 6, h: 4 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🔌 POWER (pmset)</span>
                    <span id="_sxp_msg" style="color:var(--text-dim);margin-left:auto"></span>
                  </div>
                  <div class="metric-row"><span class="k">SOURCE</span><span class="v"><b id="_sxp_src">—</b></span></div>
                  <div class="metric-row"><span class="k">CHARGE</span><span class="v" id="_sxp_chg">—</span></div>
                  <div class="bar"><i id="_sxp_bar"></i></div>
                  <div class="metric-row" style="margin-top:6px"><span class="k">STATE</span><span class="v" id="_sxp_state">—</span></div>
                  <div class="metric-row"><span class="k">CPU THERMAL</span><span class="v" id="_sxp_therm">—</span></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const [batt, therm] = await Promise.all([
                        window.dyo.exec("pmset", ["-g", "batt"], { timeout: 6000 }),
                        window.dyo.exec("pmset", ["-g", "therm"], { timeout: 6000 })
                    ]);
                    if (!batt || (batt.code !== 0 && !batt.stdout)) {
                        $("#_sxp_msg").textContent = "pmset unavailable";
                        return;
                    }
                    $("#_sxp_msg").textContent = "";
                    const out = batt.stdout || "";
                    // "Now drawing from 'AC Power'" or 'Battery Power'
                    const srcM = /drawing from '([^']+)'/i.exec(out);
                    $("#_sxp_src").textContent = srcM ? srcM[1] : "unknown";
                    // percentage and state on the battery line
                    const pctM = /(\d+)%/.exec(out);
                    const pct = pctM ? parseInt(pctM[1], 10) : null;
                    if (pct != null) {
                        $("#_sxp_chg").textContent = pct + "%";
                        const col = pct <= 15 ? "var(--danger)" : pct <= 35 ? "var(--accent2)" : "var(--accent)";
                        const bar = $("#_sxp_bar");
                        bar.style.width = pct + "%";
                        bar.style.background = col;
                    } else {
                        $("#_sxp_chg").textContent = "n/a";
                        $("#_sxp_bar").style.width = "0%";
                    }
                    // state: charged / charging / discharging + time
                    const stM = /\d+%;\s*([^;]+);\s*([^\n]*)/.exec(out);
                    let state = "—";
                    if (stM) {
                        const s = stM[1].trim();
                        const t = (stM[2] || "").trim();
                        state = s + (/(\d+:\d+)/.test(t) ? " (" + /(\d+:\d+)/.exec(t)[1] + ")" : "");
                    } else if (srcM && /AC/i.test(srcM[1])) {
                        state = "on AC";
                    }
                    $("#_sxp_state").textContent = state;

                    // thermal
                    let thermTxt = "n/a";
                    if (therm && therm.stdout) {
                        const cM = /CPU_Scheduler_Limit\s*=\s*(\d+)/.exec(therm.stdout);
                        const sM = /CPU_Speed_Limit\s*=\s*(\d+)/.exec(therm.stdout);
                        if (sM) thermTxt = "speed limit " + sM[1] + "%";
                        else if (cM) thermTxt = "sched limit " + cM[1] + "%";
                        else if (/No thermal/i.test(therm.stdout)) thermTxt = "nominal";
                        else thermTxt = "nominal";
                    }
                    const te = $("#_sxp_therm");
                    te.textContent = thermTxt;
                    te.style.color = /100%|nominal/.test(thermTxt) ? "var(--text)" : "var(--accent2)";
                } catch (e) {
                    $("#_sxp_msg").textContent = "error";
                } finally { busy = false; }
            };
            tick();
            const iv = setInterval(tick, 6000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
