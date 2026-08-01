"use strict";
window.I18N.register({
    en: { "widget.graph_ramhist": "RAM History", "cat.monitoring": "Monitoring" },
    ru: { "widget.graph_ramhist": "История RAM", "cat.monitoring": "Мониторинг" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.graph_ramhist = {
    id: "graph_ramhist",
    title: "widget.graph_ramhist",
    category: "monitoring",
    description: "Rolling memory usage % history graph",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        body.innerHTML = `
            <div style="position:relative;height:100%;display:flex;flex-direction:column">
              <div style="position:absolute;top:2px;left:4px;z-index:2;pointer-events:none">
                <span style="font-size:11px;color:var(--text-dim);letter-spacing:.05em">RAM</span>
                <div style="font-size:30px;font-weight:600;line-height:1;color:var(--text);font-variant-numeric:tabular-nums"><span id="_g_val">--</span><span style="font-size:15px;color:var(--text-dim)">%</span></div>
                <div id="_g_abs" style="font-size:11px;color:var(--text-dim);font-variant-numeric:tabular-nums"></div>
              </div>
              <canvas id="_g_c" style="width:100%;flex:1 1 auto;min-height:40px"></canvas>
              <div id="_g_msg" style="position:absolute;bottom:2px;left:4px;color:var(--text-dim);font-size:11px"></div>
            </div>`;
        const valEl = body.querySelector("#_g_val");
        const absEl = body.querySelector("#_g_abs");
        const msgEl = body.querySelector("#_g_msg");
        const canvas = body.querySelector("#_g_c");
        const ctx = canvas.getContext("2d");
        const hist = [];
        let alive = true, busy = false;
        const gb = n => n / 1e9;
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
            const xOf = i => (i / (hist.length - 1)) * w;
            const yOf = v => h - pad - (Math.max(0, Math.min(100, v)) / 100) * (h - 2 * pad);
            ctx.beginPath();
            ctx.moveTo(0, h);
            hist.forEach((v, i) => ctx.lineTo(xOf(i), yOf(v)));
            ctx.lineTo(w, h);
            ctx.closePath();
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, "rgba(79,210,255,0.28)");
            grad.addColorStop(1, "rgba(79,210,255,0)");
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.beginPath();
            hist.forEach((v, i) => i ? ctx.lineTo(xOf(i), yOf(v)) : ctx.moveTo(xOf(i), yOf(v)));
            const lg = ctx.createLinearGradient(0, 0, w, 0);
            lg.addColorStop(0, accent);
            lg.addColorStop(1, accent2);
            ctx.strokeStyle = lg;
            ctx.lineWidth = 1.5 * dpr;
            ctx.stroke();
        };
        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const mem = await window.dyo.si("mem");
                if (!alive) return;
                if (!mem || !mem.total) {
                    msgEl.textContent = "memory info unavailable";
                    return;
                }
                msgEl.textContent = "";
                const used = mem.active != null ? mem.active : (mem.total - mem.available);
                const pct = Math.max(0, Math.min(100, (used / mem.total) * 100));
                valEl.textContent = pct.toFixed(0);
                absEl.textContent = gb(used).toFixed(1) + " / " + gb(mem.total).toFixed(0) + " GB";
                hist.push(pct);
                if (hist.length > 120) hist.shift();
                draw();
            } catch (e) {
                msgEl.textContent = "memory info unavailable";
            } finally {
                busy = false;
            }
        };
        tick();
        const iv = setInterval(tick, 1800);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
