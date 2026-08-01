"use strict";
window.I18N.register({
    en: { "widget.info_cpu": "CPU Info", "cat.system": "System" },
    ru: { "widget.info_cpu": "Процессор", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.info_cpu = {
        id: "info_cpu",
        title: "widget.info_cpu",
        category: "system",
        description: "CPU: manufacturer, brand, cores, speed",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🧠 CPU</span>
                    <b class="_brand" style="color:var(--accent);cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="Click to copy">—</b>
                    <span class="_msg" style="color:var(--text-dim);margin-left:auto;font-size:11px"></span>
                  </div>
                  <div class="metric-row"><span class="k">VENDOR</span><span class="v _mfr" style="font-family:var(--font-mono)">—</span></div>
                  <div class="metric-row"><span class="k">CORES</span><span class="v _cores" style="font-family:var(--font-mono)">—</span></div>
                  <div class="metric-row"><span class="k">PHYSICAL</span><span class="v _phys" style="font-family:var(--font-mono)">—</span></div>
                  <div class="metric-row"><span class="k">SPEED</span><span class="v _speed" style="font-family:var(--font-mono)">—</span></div>
                  <div class="metric-row"><span class="k">MAX SPEED</span><span class="v _smax" style="font-family:var(--font-mono)">—</span></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            $("._brand").onclick = () => { const t = $("._brand").textContent.trim(); if (t && t !== "—") navigator.clipboard.writeText(t).catch(() => {}); };

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const d = await window.dyo.si("cpu");
                    if (!alive) return;
                    if (!d || d.error) { $("._msg").textContent = "unavailable"; return; }
                    const brand = d.brand || d.manufacturer || "—";
                    $("._brand").textContent = brand;
                    $("._brand").title = brand;
                    $("._mfr").textContent = d.manufacturer || "—";
                    $("._cores").textContent = (d.cores != null ? d.cores : "—") + (d.processors > 1 ? " (" + d.processors + " sockets)" : "");
                    $("._phys").textContent = d.physicalCores != null ? d.physicalCores : "—";
                    $("._speed").textContent = d.speed ? d.speed + " GHz" : "—";
                    $("._smax").textContent = d.speedMax ? d.speedMax + " GHz" : "—";
                    $("._msg").textContent = "";
                } catch (e) {
                    if (alive) $("._msg").textContent = "error";
                } finally { busy = false; }
            };
            tick();
            const iv = setInterval(tick, 60000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
