"use strict";
window.I18N.register({
    en: {
        "widget.proccount": "Process Count", "cat.monitoring": "Monitoring",
        "proccount.total": "Total", "proccount.running": "Running", "proccount.sleeping": "Sleeping"
    },
    ru: {
        "widget.proccount": "Счётчик процессов", "cat.monitoring": "Мониторинг",
        "proccount.total": "Всего", "proccount.running": "Активно", "proccount.sleeping": "Спящие"
    }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.proccount = {
    id: "proccount",
    title: "widget.proccount",
    category: "monitoring",
    description: "Total / running / sleeping processes",
    defaultSize: { w: 6, h: 2 },
    mount(body) {
        const t = window.I18N.t.bind(window.I18N);
        body.innerHTML = `
            <div style="height:100%;display:flex;flex-direction:column;justify-content:center">
              <div style="display:flex;justify-content:space-around;text-align:center;gap:8px">
                <div><div id="_pc_total" style="font:600 24px var(--font-mono);color:var(--accent)">--</div><div style="color:var(--text-dim);font-size:11px;letter-spacing:.5px">${t("proccount.total")}</div></div>
                <div><div id="_pc_run" style="font:600 24px var(--font-mono);color:var(--accent2)">--</div><div style="color:var(--text-dim);font-size:11px;letter-spacing:.5px">${t("proccount.running")}</div></div>
                <div><div id="_pc_sleep" style="font:600 24px var(--font-mono);color:var(--text)">--</div><div style="color:var(--text-dim);font-size:11px;letter-spacing:.5px">${t("proccount.sleeping")}</div></div>
              </div>
              <div id="_pc_msg" style="color:var(--text-dim);font-size:11px;text-align:center;margin-top:6px"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const p = await window.dyo.si("processes");
                if (!alive) return;
                if (!p || p.all == null) {
                    $("#_pc_msg").textContent = "process stats unavailable";
                    return;
                }
                $("#_pc_msg").textContent = "";
                $("#_pc_total").textContent = p.all != null ? p.all : "--";
                $("#_pc_run").textContent = p.running != null ? p.running : "--";
                $("#_pc_sleep").textContent = p.sleeping != null ? p.sleeping : "--";
            } catch (e) {
                $("#_pc_msg").textContent = "process stats unavailable";
            } finally {
                busy = false;
            }
        };
        tick();
        const iv = setInterval(tick, 2500);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
