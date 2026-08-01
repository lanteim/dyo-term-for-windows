"use strict";
window.I18N.register({
    en: {
        "widget.htop": "Process Monitor",
        "cat.monitoring": "Monitoring",
        "htop.pid": "PID", "htop.name": "NAME", "htop.cpu": "CPU%", "htop.mem": "MEM%"
    },
    ru: {
        "widget.htop": "Монитор процессов",
        "cat.monitoring": "Мониторинг",
        "htop.pid": "PID", "htop.name": "ИМЯ", "htop.cpu": "CPU%", "htop.mem": "ОЗУ%"
    }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.htop = {
    id: "htop",
    title: "widget.htop",
    category: "monitoring",
    description: "Top processes by CPU (PID/NAME/CPU%/MEM%)",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const t = window.I18N.t.bind(window.I18N);
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="font:12px var(--font-mono);height:100%;display:flex;flex-direction:column">
              <div style="display:flex;gap:8px;padding:2px 4px 6px;color:var(--text-dim);border-bottom:1px solid var(--border);letter-spacing:.5px">
                <span style="width:64px;flex:0 0 auto">${t("htop.pid")}</span>
                <span style="flex:1 1 auto;min-width:0">${t("htop.name")}</span>
                <span style="width:64px;flex:0 0 auto;text-align:right">${t("htop.cpu")}</span>
                <span style="width:64px;flex:0 0 auto;text-align:right">${t("htop.mem")}</span>
              </div>
              <div id="_ht_rows" style="flex:1 1 auto;overflow:auto"></div>
              <div id="_ht_msg" style="color:var(--text-dim);padding:6px 4px">Loading…</div>
            </div>`;
        const rowsEl = body.querySelector("#_ht_rows");
        const msgEl = body.querySelector("#_ht_msg");
        let alive = true, busy = false;
        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const p = await window.dyo.si("processes");
                if (!alive) return;
                if (!p || !Array.isArray(p.list) || !p.list.length) {
                    msgEl.textContent = "process list unavailable";
                    return;
                }
                msgEl.textContent = "";
                const list = p.list.slice().sort((a, b) => (b.cpu || 0) - (a.cpu || 0)).slice(0, 12);
                rowsEl.innerHTML = list.map(pr => {
                    const cpu = (pr.cpu || 0);
                    const mem = (pr.mem || 0);
                    const cpuColor = cpu > 50 ? "var(--danger)" : cpu > 15 ? "var(--accent)" : "var(--text)";
                    return `<div style="display:flex;gap:8px;padding:2px 4px;align-items:baseline">
                        <span style="width:64px;flex:0 0 auto;color:var(--text-dim);font-variant-numeric:tabular-nums">${esc(pr.pid)}</span>
                        <span style="flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(pr.name)}</span>
                        <span style="width:64px;flex:0 0 auto;text-align:right;font-variant-numeric:tabular-nums;color:${cpuColor}">${cpu.toFixed(1)}</span>
                        <span style="width:64px;flex:0 0 auto;text-align:right;font-variant-numeric:tabular-nums;color:var(--text-dim)">${mem.toFixed(1)}</span>
                    </div>`;
                }).join("");
            } catch (e) {
                msgEl.textContent = "process list unavailable";
            } finally {
                busy = false;
            }
        };
        tick();
        const iv = setInterval(tick, 2000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
