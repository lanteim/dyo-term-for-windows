"use strict";
window.I18N.register({
    en: { "widget.info_uptime2": "Uptime", "cat.system": "System" },
    ru: { "widget.info_uptime2": "Аптайм", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const fmt = (secs) => {
        secs = Math.max(0, Math.floor(secs));
        const d = Math.floor(secs / 86400);
        const h = Math.floor((secs % 86400) / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        const p = [];
        if (d) p.push(d + "d");
        if (d || h) p.push(h + "h");
        p.push(m + "m");
        if (!d) p.push(s + "s");
        return p.join(" ");
    };

    window.WIDGETS.info_uptime2 = {
        id: "info_uptime2",
        title: "widget.info_uptime2",
        category: "system",
        description: "System uptime and boot time",
        defaultSize: { w: 6, h: 2 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:baseline;gap:8px">
                    <span style="color:var(--text-dim)">⏱️ UPTIME</span>
                    <b class="_up" style="color:var(--accent);font-family:var(--font-mono);font-size:18px">—</b>
                    <span class="_msg" style="color:var(--text-dim);margin-left:auto;font-size:11px"></span>
                  </div>
                  <div class="metric-row"><span class="k">BOOT TIME</span><span class="v _boot" style="font-family:var(--font-mono);cursor:pointer" title="Click to copy">—</span></div>
                  <div class="metric-row"><span class="k">SECONDS</span><span class="v _secs" style="font-family:var(--font-mono)">—</span></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false, baseUptime = null, baseAt = 0, bootDate = null;

            $("._boot").onclick = () => { const t = $("._boot").textContent.trim(); if (t && t !== "—") navigator.clipboard.writeText(t).catch(() => {}); };

            const paint = () => {
                if (baseUptime == null) return;
                const cur = baseUptime + (Date.now() - baseAt) / 1000;
                $("._up").textContent = fmt(cur);
                $("._secs").textContent = Math.floor(cur).toLocaleString();
            };

            const fetch = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const t = await window.dyo.si("time");
                    if (!alive) return;
                    if (!t || typeof t.uptime !== "number") { $("._msg").textContent = "unavailable"; return; }
                    baseUptime = t.uptime;
                    baseAt = Date.now();
                    bootDate = new Date(Date.now() - t.uptime * 1000);
                    $("._boot").textContent = bootDate.toLocaleString();
                    $("._msg").textContent = "";
                    paint();
                } catch (e) { if (alive) $("._msg").textContent = "error"; } finally { busy = false; }
            };
            fetch();
            const tickIv = setInterval(paint, 1000);
            const syncIv = setInterval(fetch, 30000);
            return { destroy: () => { alive = false; clearInterval(tickIv); clearInterval(syncIv); } };
        }
    };
})();
