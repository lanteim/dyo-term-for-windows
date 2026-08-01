"use strict";
window.I18N.register({
    en: { "widget.sysx_mempressure": "Memory Pressure", "cat.system": "System" },
    ru: { "widget.sysx_mempressure": "Давление памяти", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const gb = b => (typeof b === "number" && b >= 0) ? (b / (1024 ** 3)).toFixed(1) + "G" : "n/a";

    window.WIDGETS.sysx_mempressure = {
        id: "sysx_mempressure",
        title: "widget.sysx_mempressure",
        category: "system",
        description: "memory usage pressure & swap",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🧠 MEMORY</span>
                    <span id="_sxm_msg" style="color:var(--text-dim);margin-left:auto"></span>
                  </div>
                  <div class="metric-row"><span class="k">PRESSURE</span><span class="v"><b id="_sxm_p">—</b></span></div>
                  <div class="bar"><i id="_sxm_bar"></i></div>
                  <div class="metric-row" style="margin-top:6px"><span class="k">USED / TOTAL</span><span class="v" id="_sxm_used">—</span></div>
                  <div class="metric-row"><span class="k">ACTIVE</span><span class="v" id="_sxm_active">—</span></div>
                  <div class="metric-row"><span class="k">SWAP USED</span><span class="v" id="_sxm_swap">—</span></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const mem = await window.dyo.si("mem");
                    if (!mem || !mem.total) { $("#_sxm_msg").textContent = "unavailable"; return; }
                    $("#_sxm_msg").textContent = "";
                    // pressure: (active + wired-ish) vs total; use (total-available)/total
                    const avail = typeof mem.available === "number" ? mem.available : (mem.free + (mem.cached || 0) + (mem.buffers || 0));
                    const used = mem.total - avail;
                    const pct = Math.max(0, Math.min(100, Math.round((used / mem.total) * 100)));
                    const col = pct >= 90 ? "var(--danger)" : pct >= 75 ? "var(--accent2)" : "var(--accent)";
                    const p = $("#_sxm_p");
                    p.textContent = pct + "%";
                    p.style.color = col;
                    const bar = $("#_sxm_bar");
                    bar.style.width = pct + "%";
                    bar.style.background = col;
                    $("#_sxm_used").textContent = gb(used) + " / " + gb(mem.total);
                    $("#_sxm_active").textContent = gb(mem.active);
                    const swapUsed = mem.swapused || 0;
                    const swEl = $("#_sxm_swap");
                    swEl.textContent = gb(swapUsed) + (mem.swaptotal ? " / " + gb(mem.swaptotal) : "");
                    swEl.style.color = swapUsed > (mem.total * 0.1) ? "var(--accent2)" : "var(--text)";
                } catch (e) {
                    $("#_sxm_msg").textContent = "error";
                } finally { busy = false; }
            };
            tick();
            const iv = setInterval(tick, 3000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
