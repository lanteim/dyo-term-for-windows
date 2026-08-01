"use strict";
window.I18N.register({
    en: { "widget.graph_nethist": "Network History", "cat.monitoring": "Monitoring" },
    ru: { "widget.graph_nethist": "История сети", "cat.monitoring": "Мониторинг" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.graph_nethist = {
    id: "graph_nethist",
    title: "widget.graph_nethist",
    category: "monitoring",
    description: "Rolling network rx/tx throughput history (dual line)",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        body.innerHTML = `
            <div style="position:relative;height:100%;display:flex;flex-direction:column">
              <div style="position:absolute;top:2px;left:4px;z-index:2;pointer-events:none">
                <span style="font-size:11px;color:var(--text-dim);letter-spacing:.05em">NET</span>
                <div style="font-size:13px;font-weight:600;line-height:1.3;font-variant-numeric:tabular-nums">
                  <span style="color:var(--accent2)">&#9660; <span id="_g_rx">--</span></span><br>
                  <span style="color:var(--accent)">&#9650; <span id="_g_tx">--</span></span>
                </div>
              </div>
              <canvas id="_g_c" style="width:100%;flex:1 1 auto;min-height:40px"></canvas>
              <div id="_g_msg" style="position:absolute;bottom:2px;left:4px;color:var(--text-dim);font-size:11px"></div>
            </div>`;
        const rxEl = body.querySelector("#_g_rx");
        const txEl = body.querySelector("#_g_tx");
        const msgEl = body.querySelector("#_g_msg");
        const canvas = body.querySelector("#_g_c");
        const ctx = canvas.getContext("2d");
        const rxH = [], txH = [];
        let alive = true, busy = false;
        const rate = n => {
            if (n == null || !isFinite(n) || n < 0) n = 0;
            if (n < 1024) return n.toFixed(0) + " B/s";
            if (n < 1048576) return (n / 1024).toFixed(1) + " K/s";
            if (n < 1073741824) return (n / 1048576).toFixed(1) + " M/s";
            return (n / 1073741824).toFixed(2) + " G/s";
        };
        const line = (arr, max, w, h, pad, color, fillCol) => {
            const xOf = i => (i / (arr.length - 1)) * w;
            const yOf = v => h - pad - (max > 0 ? (v / max) : 0) * (h - 2 * pad);
            ctx.beginPath();
            ctx.moveTo(0, h);
            arr.forEach((v, i) => ctx.lineTo(xOf(i), yOf(v)));
            ctx.lineTo(w, h);
            ctx.closePath();
            ctx.fillStyle = fillCol;
            ctx.fill();
            ctx.beginPath();
            arr.forEach((v, i) => i ? ctx.lineTo(xOf(i), yOf(v)) : ctx.moveTo(xOf(i), yOf(v)));
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5 * (window.devicePixelRatio || 1);
            ctx.stroke();
        };
        const draw = () => {
            const dpr = window.devicePixelRatio || 1;
            const w = canvas.width = Math.max(1, canvas.clientWidth * dpr);
            const h = canvas.height = Math.max(1, canvas.clientHeight * dpr);
            ctx.clearRect(0, 0, w, h);
            if (rxH.length < 2) return;
            const cs = getComputedStyle(document.documentElement);
            const accent = cs.getPropertyValue("--accent").trim() || "#7aa2f7";
            const accent2 = cs.getPropertyValue("--accent2").trim() || "#4fd2ff";
            const pad = 3 * dpr;
            const max = Math.max(1, ...rxH, ...txH);
            line(rxH, max, w, h, pad, accent2, "rgba(79,210,255,0.20)");
            line(txH, max, w, h, pad, accent, "rgba(122,162,247,0.16)");
        };
        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const st = await window.dyo.si("networkStats");
                if (!alive) return;
                const arr = Array.isArray(st) ? st : (st ? [st] : null);
                if (!arr || !arr.length) {
                    msgEl.textContent = "network stats unavailable";
                    return;
                }
                msgEl.textContent = "";
                let rx = 0, tx = 0;
                for (const n of arr) {
                    if (n && typeof n.rx_sec === "number" && n.rx_sec >= 0) rx += n.rx_sec;
                    if (n && typeof n.tx_sec === "number" && n.tx_sec >= 0) tx += n.tx_sec;
                }
                rxEl.textContent = rate(rx);
                txEl.textContent = rate(tx);
                rxH.push(rx); txH.push(tx);
                if (rxH.length > 120) rxH.shift();
                if (txH.length > 120) txH.shift();
                draw();
            } catch (e) {
                msgEl.textContent = "network stats unavailable";
            } finally {
                busy = false;
            }
        };
        tick();
        const iv = setInterval(tick, 1800);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
