"use strict";
window.I18N.register({
    en: { "widget.graph_temphist": "CPU Temp History", "cat.monitoring": "Monitoring" },
    ru: { "widget.graph_temphist": "История темп. CPU", "cat.monitoring": "Мониторинг" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.graph_temphist = {
    id: "graph_temphist",
    title: "widget.graph_temphist",
    category: "monitoring",
    description: "Rolling CPU temperature history graph",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        body.innerHTML = `
            <div style="position:relative;height:100%;display:flex;flex-direction:column">
              <div style="position:absolute;top:2px;left:4px;z-index:2;pointer-events:none">
                <span style="font-size:11px;color:var(--text-dim);letter-spacing:.05em">CPU TEMP</span>
                <div style="font-size:30px;font-weight:600;line-height:1;color:var(--text);font-variant-numeric:tabular-nums"><span id="_g_val">--</span><span style="font-size:15px;color:var(--text-dim)">&deg;C</span></div>
              </div>
              <canvas id="_g_c" style="width:100%;flex:1 1 auto;min-height:40px"></canvas>
              <div id="_g_msg" style="position:absolute;bottom:2px;left:4px;color:var(--text-dim);font-size:11px"></div>
            </div>`;
        const valEl = body.querySelector("#_g_val");
        const msgEl = body.querySelector("#_g_msg");
        const canvas = body.querySelector("#_g_c");
        const ctx = canvas.getContext("2d");
        const hist = [];
        let alive = true, busy = false;
        const draw = () => {
            const dpr = window.devicePixelRatio || 1;
            const w = canvas.width = Math.max(1, canvas.clientWidth * dpr);
            const h = canvas.height = Math.max(1, canvas.clientHeight * dpr);
            ctx.clearRect(0, 0, w, h);
            if (hist.length < 2) return;
            const cs = getComputedStyle(document.documentElement);
            const danger = cs.getPropertyValue("--danger").trim() || "#f7768e";
            const accent2 = cs.getPropertyValue("--accent2").trim() || "#4fd2ff";
            const pad = 3 * dpr;
            // fixed 20-100°C scale for meaningful readings
            const lo = 20, hi = 100;
            const xOf = i => (i / (hist.length - 1)) * w;
            const yOf = v => h - pad - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * (h - 2 * pad);
            ctx.beginPath();
            ctx.moveTo(0, h);
            hist.forEach((v, i) => ctx.lineTo(xOf(i), yOf(v)));
            ctx.lineTo(w, h);
            ctx.closePath();
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, "rgba(247,118,142,0.28)");
            grad.addColorStop(1, "rgba(247,118,142,0)");
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.beginPath();
            hist.forEach((v, i) => i ? ctx.lineTo(xOf(i), yOf(v)) : ctx.moveTo(xOf(i), yOf(v)));
            const lg = ctx.createLinearGradient(0, 0, w, 0);
            lg.addColorStop(0, accent2);
            lg.addColorStop(1, danger);
            ctx.strokeStyle = lg;
            ctx.lineWidth = 1.5 * dpr;
            ctx.stroke();
        };
        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const t = await window.dyo.si("cpuTemperature");
                if (!alive) return;
                if (!t || typeof t.main !== "number" || !(t.main > 0)) {
                    msgEl.textContent = "temperature sensor not available";
                    valEl.textContent = "n/a";
                    return;
                }
                msgEl.textContent = "";
                const temp = t.main;
                valEl.textContent = Math.round(temp);
                hist.push(temp);
                if (hist.length > 120) hist.shift();
                draw();
            } catch (e) {
                msgEl.textContent = "temperature sensor not available";
            } finally {
                busy = false;
            }
        };
        tick();
        const iv = setInterval(tick, 1800);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
