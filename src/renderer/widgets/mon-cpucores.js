"use strict";
window.I18N.register({
    en: { "widget.cpucores": "CPU Cores", "cat.monitoring": "Monitoring" },
    ru: { "widget.cpucores": "Ядра CPU", "cat.monitoring": "Мониторинг" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.cpucores = {
    id: "cpucores",
    title: "widget.cpucores",
    category: "monitoring",
    description: "Per-core CPU load bars",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        body.innerHTML = `
            <div style="height:100%;display:flex;flex-direction:column">
              <div id="_cc_bars" style="flex:1 1 auto;overflow:auto;display:flex;flex-direction:column;gap:4px"></div>
              <div id="_cc_msg" style="color:var(--text-dim);padding-top:4px;font-size:11px"></div>
            </div>`;
        const barsEl = body.querySelector("#_cc_bars");
        const msgEl = body.querySelector("#_cc_msg");
        let alive = true, busy = false, built = 0;
        const ensureRows = n => {
            if (built === n) return;
            barsEl.innerHTML = "";
            for (let i = 0; i < n; i++) {
                const row = document.createElement("div");
                row.style.cssText = "display:flex;align-items:center;gap:8px";
                row.innerHTML = `
                    <span style="width:34px;flex:0 0 auto;color:var(--text-dim);font:11px var(--font-mono)">c${i}</span>
                    <span class="bar" style="flex:1 1 auto;height:8px"><i data-core="${i}"></i></span>
                    <span data-val="${i}" style="width:38px;flex:0 0 auto;text-align:right;font:11px var(--font-mono);font-variant-numeric:tabular-nums">0%</span>`;
                barsEl.appendChild(row);
            }
            built = n;
        };
        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const load = await window.dyo.si("currentLoad");
                if (!alive) return;
                const cpus = load && Array.isArray(load.cpus) ? load.cpus : null;
                if (!cpus || !cpus.length) {
                    msgEl.textContent = "per-core load unavailable";
                    return;
                }
                msgEl.textContent = "";
                ensureRows(cpus.length);
                cpus.forEach((c, i) => {
                    const v = Math.max(0, Math.min(100, Math.round(c.load || 0)));
                    const bar = barsEl.querySelector(`i[data-core="${i}"]`);
                    const val = barsEl.querySelector(`[data-val="${i}"]`);
                    if (bar) bar.style.width = v + "%";
                    if (val) val.textContent = v + "%";
                });
            } catch (e) {
                msgEl.textContent = "per-core load unavailable";
            } finally {
                busy = false;
            }
        };
        tick();
        const iv = setInterval(tick, 2000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
