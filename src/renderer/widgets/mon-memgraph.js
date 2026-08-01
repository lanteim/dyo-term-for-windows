"use strict";
window.I18N.register({
    en: { "widget.memgraph": "Memory Graph", "cat.monitoring": "Monitoring" },
    ru: { "widget.memgraph": "График памяти", "cat.monitoring": "Мониторинг" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.memgraph = {
    id: "memgraph",
    title: "widget.memgraph",
    category: "monitoring",
    description: "Memory usage % sparkline over time",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        body.innerHTML = `
            <div style="height:100%;display:flex;flex-direction:column">
              <div class="metric-row"><span class="k">MEM</span><span class="v"><b id="_mg_pct">--</b>% · <span id="_mg_abs">--</span></span></div>
              <canvas id="_mg_c" style="width:100%;flex:1 1 auto;min-height:40px;margin-top:6px"></canvas>
              <div id="_mg_msg" style="color:var(--text-dim);font-size:11px"></div>
            </div>`;
        const pctEl = body.querySelector("#_mg_pct");
        const absEl = body.querySelector("#_mg_abs");
        const msgEl = body.querySelector("#_mg_msg");
        const canvas = body.querySelector("#_mg_c");
        const ctx = canvas.getContext("2d");
        const hist = [];
        let alive = true, busy = false;
        const gb = n => (n / 1e9);
        const draw = () => {
            const dpr = window.devicePixelRatio || 1;
            const w = canvas.width = Math.max(1, canvas.clientWidth * dpr);
            const h = canvas.height = Math.max(1, canvas.clientHeight * dpr);
            ctx.clearRect(0, 0, w, h);
            if (hist.length < 2) return;
            const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#7aa2f7";
            const accent2 = getComputedStyle(document.documentElement).getPropertyValue("--accent2").trim() || "#4fd2ff";
            const pad = 3 * dpr;
            const xOf = i => (i / (hist.length - 1)) * w;
            const yOf = v => h - pad - (v / 100) * (h - 2 * pad);
            // fill
            ctx.beginPath();
            ctx.moveTo(0, h);
            hist.forEach((v, i) => ctx.lineTo(xOf(i), yOf(v)));
            ctx.lineTo(w, h);
            ctx.closePath();
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, "rgba(122,162,247,0.28)");
            grad.addColorStop(1, "rgba(122,162,247,0)");
            ctx.fillStyle = grad;
            ctx.fill();
            // line
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
                const mem = await window.dyo.si("mem");
                if (!alive) return;
                if (!mem || !mem.total) {
                    msgEl.textContent = "memory info unavailable";
                    return;
                }
                msgEl.textContent = "";
                const used = mem.active != null ? mem.active : (mem.total - mem.available);
                const pct = Math.max(0, Math.min(100, (used / mem.total) * 100));
                pctEl.textContent = pct.toFixed(0);
                absEl.textContent = gb(used).toFixed(1) + " / " + gb(mem.total).toFixed(0) + " GB";
                hist.push(pct);
                if (hist.length > 90) hist.shift();
                draw();
            } catch (e) {
                msgEl.textContent = "memory info unavailable";
            } finally {
                busy = false;
            }
        };
        tick();
        const iv = setInterval(tick, 2000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
