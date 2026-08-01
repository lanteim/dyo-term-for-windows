"use strict";
window.I18N.register({
    en: { "widget.mac_diskspace": "Disk Space", "cat.system": "System" },
    ru: { "widget.mac_diskspace": "Диск", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.mac_diskspace = {
    id: "mac_diskspace",
    title: "widget.mac_diskspace",
    category: "system",
    description: "Used/free space on mounted volumes",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const gb = v => {
            if (typeof v !== "number" || !isFinite(v)) return "—";
            if (v >= 1024 ** 4) return (v / 1024 ** 4).toFixed(2) + " TB";
            if (v >= 1024 ** 3) return (v / 1024 ** 3).toFixed(1) + " GB";
            return (v / 1024 ** 2).toFixed(0) + " MB";
        };
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="color:var(--text-dim)">💾 DISK SPACE</span>
                <span id="_disk_meta" style="color:var(--text-dim);margin-left:auto;font-size:11px"></span>
              </div>
              <div id="_disk_list" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:8px"></div>
              <div id="_disk_msg" style="color:var(--text-dim);font-size:11px"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;

        const render = vols => {
            if (!vols || !vols.length) {
                $("#_disk_list").innerHTML = `<div style="color:var(--text-dim);padding:6px">No volume info available.</div>`;
                return;
            }
            $("#_disk_list").innerHTML = vols.slice(0, 20).map(v => {
                const size = v.size || 0;
                const used = typeof v.used === "number" ? v.used : (size - (v.available || 0));
                const pct = size > 0 ? Math.min(100, Math.round(used / size * 100)) : 0;
                const danger = pct >= 90;
                const warn = pct >= 75;
                const col = danger ? "var(--danger)" : (warn ? "var(--accent2)" : "var(--accent)");
                const label = v.mount || v.fs || "volume";
                return `<div>
                    <div class="metric-row"><span class="k" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55%" title="${esc(label)}">${esc(label)}</span>
                      <span class="v">${gb(used)} / ${gb(size)} (${pct}%)</span></div>
                    <div class="bar"><i style="width:${pct}%;background:${col}"></i></div>
                    <div style="color:var(--text-dim);font-size:11px;margin-top:2px">free ${gb(size - used)}${v.type ? " · " + esc(v.type) : ""}</div>
                  </div>`;
            }).join("");
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            $("#_disk_meta").textContent = "…";
            try {
                const fs = await window.dyo.si("fsSize");
                if (!alive) return;
                let vols = Array.isArray(fs) ? fs : [];
                // Keep real disk volumes; drop tiny/system pseudo mounts.
                vols = vols.filter(v => v && typeof v.size === "number" && v.size > 0 &&
                    !/^(devfs|autofs|map )/.test(v.fs || "") &&
                    !/^\/(dev|System\/Volumes\/(VM|Preboot|Update|xarts|iSCPreboot|Hardware))/.test(v.mount || ""));
                // Sort: main/root first, then largest.
                vols.sort((a, b) => {
                    const am = (a.mount === "/" || a.mount === "/System/Volumes/Data") ? 1 : 0;
                    const bm = (b.mount === "/" || b.mount === "/System/Volumes/Data") ? 1 : 0;
                    if (am !== bm) return bm - am;
                    return (b.size || 0) - (a.size || 0);
                });
                render(vols);
                $("#_disk_meta").textContent = vols.length + " volume" + (vols.length === 1 ? "" : "s");
                $("#_disk_msg").textContent = vols.length ? "" : "";
            } catch (e) {
                if (alive) { $("#_disk_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`; $("#_disk_meta").textContent = ""; }
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
