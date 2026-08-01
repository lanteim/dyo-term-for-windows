"use strict";
window.I18N.register({
    en: {
        "widget.gpu": "GPU", "cat.monitoring": "Monitoring",
        "gpu.util": "Utilization", "gpu.vram": "VRAM", "gpu.model": "Model"
    },
    ru: {
        "widget.gpu": "GPU", "cat.monitoring": "Мониторинг",
        "gpu.util": "Загрузка", "gpu.vram": "Видеопамять", "gpu.model": "Модель"
    }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.gpu = {
    id: "gpu",
    title: "widget.gpu",
    category: "monitoring",
    description: "GPU model, utilization and VRAM",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        const t = window.I18N.t.bind(window.I18N);
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="height:100%;display:flex;flex-direction:column">
              <div class="metric-row"><span class="k">${t("gpu.model")}</span><span class="v" id="_gpu_model" style="text-align:right;max-width:70%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">…</span></div>
              <div class="metric-row" style="margin-top:8px"><span class="k">${t("gpu.util")}</span><span class="v"><b id="_gpu_util">--</b></span></div>
              <div class="bar"><i id="_gpu_utilbar"></i></div>
              <div class="metric-row" style="margin-top:12px"><span class="k">${t("gpu.vram")}</span><span class="v" id="_gpu_vram">--</span></div>
              <div class="bar"><i id="_gpu_vrambar"></i></div>
              <div id="_gpu_msg" style="color:var(--text-dim);font-size:11px;margin-top:auto"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const g = await window.dyo.si("graphics");
                if (!alive) return;
                const c = g && Array.isArray(g.controllers) && g.controllers.length ? g.controllers[0] : null;
                if (!c) {
                    $("#_gpu_msg").textContent = "GPU info unavailable";
                    $("#_gpu_model").textContent = "n/a";
                    return;
                }
                $("#_gpu_msg").textContent = "";
                $("#_gpu_model").textContent = c.model || c.vendor || "GPU";
                $("#_gpu_model").title = c.model || "";
                if (typeof c.utilizationGpu === "number") {
                    const u = Math.max(0, Math.min(100, Math.round(c.utilizationGpu)));
                    $("#_gpu_util").textContent = u + "%";
                    $("#_gpu_utilbar").style.width = u + "%";
                } else {
                    $("#_gpu_util").textContent = "n/a";
                    $("#_gpu_utilbar").style.width = "0%";
                }
                const total = c.memoryTotal || c.vram;
                const usedMem = c.memoryUsed;
                if (total && typeof usedMem === "number") {
                    const pct = Math.max(0, Math.min(100, (usedMem / total) * 100));
                    $("#_gpu_vram").textContent = Math.round(usedMem) + " / " + Math.round(total) + " MB";
                    $("#_gpu_vrambar").style.width = pct + "%";
                } else if (total) {
                    $("#_gpu_vram").textContent = Math.round(total) + " MB";
                    $("#_gpu_vrambar").style.width = "0%";
                } else {
                    $("#_gpu_vram").textContent = "shared / n/a";
                    $("#_gpu_vrambar").style.width = "0%";
                }
            } catch (e) {
                $("#_gpu_msg").textContent = "GPU info unavailable";
            } finally {
                busy = false;
            }
        };
        tick();
        const iv = setInterval(tick, 3000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
