"use strict";
window.I18N.register({
    en: { "widget.mac_displays": "Displays", "cat.system": "System" },
    ru: { "widget.mac_displays": "Дисплеи", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.mac_displays = {
    id: "mac_displays",
    title: "widget.mac_displays",
    category: "system",
    description: "Connected displays: resolution, main, refresh",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="color:var(--text-dim)">🖥️ DISPLAYS</span>
                <span id="_dsp_meta" style="color:var(--text-dim);margin-left:auto;font-size:11px"></span>
              </div>
              <div id="_dsp_list" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:6px"></div>
              <div id="_dsp_msg" style="color:var(--text-dim);font-size:11px"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;

        const render = displays => {
            if (!displays || !displays.length) {
                $("#_dsp_list").innerHTML = `<div style="color:var(--text-dim);padding:6px">No display info available.</div>`;
                return;
            }
            $("#_dsp_list").innerHTML = displays.slice(0, 20).map(d => {
                const w = d.currentResX || d.resolutionX || 0;
                const h = d.currentResY || d.resolutionY || 0;
                const res = (w && h) ? `${w}×${h}` : "—";
                const hz = d.currentRefreshRate || d.refreshRate;
                const label = d.model || d.deviceName || d.connection || "Display";
                return `<div style="border:1px solid var(--border);border-radius:6px;padding:8px">
                    <div style="font-weight:600;color:var(--accent);display:flex;align-items:center;gap:6px">
                      ${esc(label)} ${d.main ? '<span style="font-size:10px;color:var(--accent2);border:1px solid var(--accent2);border-radius:4px;padding:0 5px">MAIN</span>' : ""}
                    </div>
                    <div class="metric-row" style="margin-top:4px"><span class="k">RESOLUTION</span><span class="v">${esc(res)}${hz ? " @ " + Math.round(hz) + "Hz" : ""}</span></div>
                    ${d.sizeX && d.sizeY ? `<div class="metric-row"><span class="k">SIZE</span><span class="v">${Math.round(d.sizeX)}×${Math.round(d.sizeY)} mm</span></div>` : ""}
                    ${d.pixelDepth ? `<div class="metric-row"><span class="k">DEPTH</span><span class="v">${esc(String(d.pixelDepth))}</span></div>` : ""}
                    ${d.connection ? `<div class="metric-row"><span class="k">CONNECTION</span><span class="v">${esc(d.connection)}</span></div>` : ""}
                  </div>`;
            }).join("");
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            $("#_dsp_meta").textContent = "…";
            try {
                const g = await window.dyo.si("graphics");
                if (!alive) return;
                const displays = (g && g.displays) || [];
                render(displays);
                $("#_dsp_msg").textContent = displays.length ? "" : "";
                $("#_dsp_meta").textContent = displays.length + " display" + (displays.length === 1 ? "" : "s");
            } catch (e) {
                if (alive) { $("#_dsp_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`; $("#_dsp_meta").textContent = ""; }
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
