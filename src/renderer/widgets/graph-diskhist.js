"use strict";
window.I18N.register({
    en: { "widget.graph_diskhist": "Disk I/O History", "cat.monitoring": "Monitoring" },
    ru: { "widget.graph_diskhist": "История диска I/O", "cat.monitoring": "Мониторинг" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.graph_diskhist = {
    id: "graph_diskhist",
    title: "widget.graph_diskhist",
    category: "monitoring",
    description: "Rolling disk I/O throughput history graph",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        body.innerHTML = `
            <div style="position:relative;height:100%;display:flex;flex-direction:column">
              <div style="position:absolute;top:2px;left:4px;z-index:2;pointer-events:none">
                <span style="font-size:11px;color:var(--text-dim);letter-spacing:.05em">DISK I/O</span>
                <div style="font-size:24px;font-weight:600;line-height:1;color:var(--text);font-variant-numeric:tabular-nums"><span id="_g_val">--</span></div>
                <div id="_g_sub" style="font-size:11px;color:var(--text-dim);font-variant-numeric:tabular-nums"></div>
              </div>
              <canvas id="_g_c" style="width:100%;flex:1 1 auto;min-height:40px"></canvas>
              <div id="_g_msg" style="position:absolute;bottom:2px;left:4px;color:var(--text-dim);font-size:11px"></div>
            </div>`;
        const valEl = body.querySelector("#_g_val");
        const subEl = body.querySelector("#_g_sub");
        const msgEl = body.querySelector("#_g_msg");
        const canvas = body.querySelector("#_g_c");
        const ctx = canvas.getContext("2d");
        const hist = [];
        let alive = true, busy = false;
        const rate = n => {
            if (n == null || !isFinite(n) || n < 0) n = 0;
            if (n < 1024) return n.toFixed(0) + " B/s";
            if (n < 1048576) return (n / 1024).toFixed(1) + " K/s";
            if (n < 1073741824) return (n / 1048576).toFixed(1) + " M/s";
            return (n / 1073741824).toFixed(2) + " G/s";
        };
        const draw = () => {
            const dpr = window.devicePixelRatio || 1;
            const w = canvas.width = Math.max(1, canvas.clientWidth * dpr);
            const h = canvas.height = Math.max(1, canvas.clientHeight * dpr);
            ctx.clearRect(0, 0, w, h);
            if (hist.length < 2) return;
            const cs = getComputedStyle(document.documentElement);
            const accent = cs.getPropertyValue("--accent").trim() || "#7aa2f7";
            const accent2 = cs.getPropertyValue("--accent2").trim() || "#4fd2ff";
            const pad = 3 * dpr;
            const max = Math.max(1, ...hist);
            const xOf = i => (i / (hist.length - 1)) * w;
            const yOf = v => h - pad - (v / max) * (h - 2 * pad);
            ctx.beginPath();
            ctx.moveTo(0, h);
            hist.forEach((v, i) => ctx.lineTo(xOf(i), yOf(v)));
            ctx.lineTo(w, h);
            ctx.closePath();
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, "rgba(122,162,247,0.30)");
            grad.addColorStop(1, "rgba(122,162,247,0)");
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.beginPath();
            hist.forEach((v, i) => i ? ctx.lineTo(xOf(i), yOf(v)) : ctx.moveTo(xOf(i), yOf(v)));
            const lg = ctx.createLinearGradient(0, 0, w, 0);
            lg.addColorStop(0, accent2);
            lg.addColorStop(1, accent);
            ctx.strokeStyle = lg;
            ctx.lineWidth = 1.5 * dpr;
            ctx.stroke();
        };
        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                let fs = await window.dyo.si("fsStats");
                if (!alive) return;
                let read = fs && typeof fs.rx_sec === "number" ? fs.rx_sec : null;
                let write = fs && typeof fs.wx_sec === "number" ? fs.wx_sec : null;
                if (read == null && write == null) {
                    const io = await window.dyo.si("disksIO");
                    if (!alive) return;
                    if (io && typeof io.rIO_sec === "number") read = io.rIO_sec;
                    if (io && typeof io.wIO_sec === "number") write = io.wIO_sec;
                }
                if (read == null && write == null) {
                    msgEl.textContent = "disk I/O unavailable";
                    return;
                }
                msgEl.textContent = "";
                read = Math.max(0, read || 0);
                write = Math.max(0, write || 0);
                const total = read + write;
                valEl.textContent = rate(total);
                subEl.textContent = "R " + rate(read) + " · W " + rate(write);
                hist.push(total);
                if (hist.length > 120) hist.shift();
                draw();
            } catch (e) {
                msgEl.textContent = "disk I/O unavailable";
            } finally {
                busy = false;
            }
        };
        tick();
        const iv = setInterval(tick, 1800);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
