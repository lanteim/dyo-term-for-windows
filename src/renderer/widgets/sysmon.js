"use strict";
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.sysmon = {
    id: "sysmon",
    title: "widget.sysmon",
    category: "system",
    description: "CPU / RAM / load / uptime",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        const t = window.I18N.t.bind(window.I18N);
        body.innerHTML = `
            <div class="metric-row"><span class="k" data-i18n="sysmon.cpu">${t("sysmon.cpu")}</span><span class="v"><b id="_sm_cpu">--</b>%</span></div>
            <div class="bar"><i id="_sm_cpubar"></i></div>
            <div class="metric-row" style="margin-top:12px"><span class="k" data-i18n="sysmon.mem">${t("sysmon.mem")}</span><span class="v"><b id="_sm_mem">--</b> / <span id="_sm_memt">--</span> GB</span></div>
            <div class="bar"><i id="_sm_membar"></i></div>
            <div class="metric-row" style="margin-top:14px"><span class="k" data-i18n="sysmon.load">${t("sysmon.load")}</span><span class="v" id="_sm_load">--</span></div>
            <div class="metric-row"><span class="k" data-i18n="sysmon.uptime">${t("sysmon.uptime")}</span><span class="v" id="_sm_up">--</span></div>`;
        const $ = id => body.querySelector(id);
        let alive = true;
        const gb = n => (n / 1e9);
        const tick = async () => {
            if (!alive) return;
            try {
                const [load, mem, time] = await Promise.all([window.dyo.si("currentLoad"), window.dyo.si("mem"), window.dyo.si("time")]);
                if (!alive) return;
                if (load && typeof load.currentLoad === "number") {
                    const p = Math.round(load.currentLoad);
                    $("#_sm_cpu").textContent = p;
                    $("#_sm_cpubar").style.width = p + "%";
                    if (load.avgLoad != null) $("#_sm_load").textContent = load.avgLoad.toFixed(2);
                }
                if (mem && mem.total) {
                    const used = mem.active != null ? mem.active : (mem.total - (mem.available || 0));
                    $("#_sm_mem").textContent = gb(used).toFixed(1);
                    $("#_sm_memt").textContent = gb(mem.total).toFixed(0);
                    $("#_sm_membar").style.width = Math.round((used / mem.total) * 100) + "%";
                }
                if (time && time.uptime != null) {
                    const u = time.uptime;
                    const dd = Math.floor(u / 86400), hh = Math.floor((u % 86400) / 3600), mm = Math.floor((u % 3600) / 60);
                    $("#_sm_up").textContent = `${dd}d ${hh}h ${mm}m`;
                }
            } catch (e) { /* transient si failure; keep last values */ }
        };
        tick();
        const iv = setInterval(tick, 2000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
