"use strict";
window.WIDGETS = window.WIDGETS || {};

function fmtRate(bytesPerSec) {
    if (!bytesPerSec || bytesPerSec < 0) bytesPerSec = 0;
    const units = ["B/s", "kB/s", "MB/s", "GB/s"];
    let i = 0, v = bytesPerSec;
    while (v >= 1000 && i < units.length - 1) { v /= 1000; i++; }
    return (v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)) + " " + units[i];
}

window.WIDGETS.netmon = {
    id: "netmon",
    title: "widget.netmon",
    category: "network",
    description: "Live traffic ↑/↓ with sparkline",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        const t = window.I18N.t.bind(window.I18N);
        body.innerHTML = `
            <div class="metric-row"><span class="k" data-i18n="net.state">${t("net.state")}</span><span class="v" id="_nm_state">…</span></div>
            <div class="metric-row"><span class="k" data-i18n="net.iface">${t("net.iface")}</span><span class="v" id="_nm_if">—</span></div>
            <div class="metric-row" style="margin-top:10px"><span class="k" data-i18n="net.down">${t("net.down")}</span><span class="v"><b id="_nm_rx">0 B/s</b></span></div>
            <div class="metric-row"><span class="k" data-i18n="net.up">${t("net.up")}</span><span class="v"><b id="_nm_tx">0 B/s</b></span></div>
            <canvas class="spark" id="_nm_spark" height="52"></canvas>`;
        const $ = id => body.querySelector(id);
        const canvas = $("#_nm_spark");
        const ctx = canvas.getContext("2d");
        const hist = [];
        let alive = true, iface = null;

        const draw = () => {
            const w = canvas.width = canvas.clientWidth * devicePixelRatio;
            const h = canvas.height = 52 * devicePixelRatio;
            ctx.clearRect(0, 0, w, h);
            if (hist.length < 2) return;
            const max = Math.max(1, ...hist.map(p => Math.max(p.rx, p.tx)));
            const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
            const accent2 = getComputedStyle(document.documentElement).getPropertyValue("--accent2").trim();
            const line = (key, color) => {
                ctx.beginPath();
                hist.forEach((p, i) => {
                    const x = (i / (hist.length - 1)) * w;
                    const y = h - (p[key] / max) * (h - 4) - 2;
                    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
                });
                ctx.strokeStyle = color; ctx.lineWidth = 1.5 * devicePixelRatio; ctx.stroke();
            };
            line("rx", accent2);
            line("tx", accent);
        };

        const tick = async () => {
            if (!alive) return;
            if (!iface) {
                const def = await window.dyo.si("networkInterfaceDefault");
                iface = def || "en0";
            }
            const stats = await window.dyo.si("networkStats", iface);
            const s = Array.isArray(stats) ? stats[0] : stats;
            if (s) {
                const online = s.operstate === "up" || s.rx_sec != null;
                $("#_nm_state").textContent = window.I18N.t(online ? "net.online" : "net.offline");
                $("#_nm_state").style.color = online ? "var(--accent2)" : "var(--danger)";
                $("#_nm_if").textContent = s.iface || iface;
                $("#_nm_rx").textContent = fmtRate(s.rx_sec);
                $("#_nm_tx").textContent = fmtRate(s.tx_sec);
                hist.push({ rx: s.rx_sec || 0, tx: s.tx_sec || 0 });
                if (hist.length > 60) hist.shift();
                draw();
            }
        };
        tick();
        const iv = setInterval(tick, 1500);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
