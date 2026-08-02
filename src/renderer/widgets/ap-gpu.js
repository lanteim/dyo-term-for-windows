"use strict";
// GPU widget — commissioned by A. Petrov. NVIDIA stats via nvidia-smi — per-GPU utilization,
// memory, temperature and power, plus a live graph of GPU0 utilization.
// Follows the active tab's ssh host; degrades where nvidia-smi is absent.
window.APWidget.define({
    id: "ap-gpu",
    title: "ap.gpu.title",
    category: "apetrov",
    description: "NVIDIA GPUs · util/mem/temp/power · live graph",
    defaultSize: { w: 6, h: 6 },
    interval: 3000,
    ranges: true,
    i18n: { en: { "ap.gpu.title": "GPU" }, ru: { "ap.gpu.title": "GPU" } },
    settings: [
        { key: "interval", label: "Refresh interval (ms)", type: "number", default: 3000 },
    ],
    render(ctx) {
        ctx.body.innerHTML = `
            <div class="metric-row"><span class="k">GPU0 UTIL</span><span class="v"><b data-ref="tot">--</b>%<span data-ref="cnt" style="color:var(--text-dim);margin-left:8px"></span></span></div>
            <canvas class="apw-graph" data-ref="g"></canvas>
            <div data-ref="gpus"></div>`;
    },
    redraw(ctx) { ctx.graph('[data-ref="g"]', "gpu", { min: 0, max: 100 }); },
    async update(ctx) {
        const esc = ctx.fmt.esc;
        const MiB = 1024 * 1024;
        // "[N/A]" / "[Not Supported]" → null, otherwise a finite number
        const num = s => { const v = parseFloat(String(s == null ? "" : s).trim()); return isFinite(v) ? v : null; };

        // ── query; missing nvidia-smi (macs, non-NVIDIA servers) → degrade ──
        let res;
        try {
            res = await ctx.exec("nvidia-smi",
                ["--query-gpu=index,name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw,power.limit",
                 "--format=csv,noheader,nounits"],
                { timeout: 8000 });
        } catch (e) { res = null; }
        if (!res || res.code !== 0 || !(res.stdout || "").trim()) {
            if (ctx.remote) return ctx.setStatus((ctx.host.label || "remote") + ": " + ((res && (res.stderr || "").split("\n").map(s => s.trim()).filter(Boolean).pop()) || "nvidia-smi not available"), "err");
            return ctx.notAvailable("nvidia-smi not available — NVIDIA GPU + driver required");
        }

        // ── parse CSV rows: index, name, util, mem.used, mem.total (MiB), temp, power.draw, power.limit (W) ──
        const gpus = (res.stdout || "").split("\n").map(l => l.trim()).filter(Boolean).map(l => {
            const c = l.split(",").map(s => s.trim());
            return {
                idx: num(c[0]) != null ? num(c[0]) : 0,
                name: c[1] || "GPU",
                util: num(c[2]),
                memUsed: num(c[3]),
                memTotal: num(c[4]),
                temp: num(c[5]),
                power: num(c[6]),
                powerLimit: num(c[7]),
            };
        });
        if (!gpus.length) {
            if (ctx.remote) return ctx.setStatus((ctx.host.label || "remote") + ": no GPUs reported", "err");
            return ctx.notAvailable("no NVIDIA GPUs found");
        }

        // ── header + GPU0 utilization history ──
        const u0 = gpus[0].util != null ? Math.round(gpus[0].util) : 0;
        ctx.ref.tot.textContent = u0;
        ctx.ref.cnt.textContent = gpus.length + " GPU" + (gpus.length === 1 ? "" : "s");
        ctx.push("gpu", u0);

        // ── per-GPU blocks: name, util bar, mem bar, temp chip, power ──
        ctx.ref.gpus.innerHTML = gpus.map(g => {
            const util = g.util != null ? Math.max(0, Math.min(100, Math.round(g.util))) : null;
            const memPct = g.memTotal ? Math.max(0, Math.min(100, (g.memUsed / g.memTotal) * 100)) : 0;
            const tCls = g.temp == null ? "" : g.temp > 90 ? "err" : g.temp > 80 ? "warn" : "ok";
            const pw = g.power != null ? g.power.toFixed(0) + (g.powerLimit != null ? " / " + g.powerLimit.toFixed(0) : "") + " W" : "—";
            return `
            <div class="apw-th" style="max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">GPU${g.idx} · ${esc(g.name)}</div>
            <div class="metric-row"><span class="k">UTIL</span><span class="v"><b>${util != null ? util : "--"}</b>%</span></div>
            <div class="bar"><i style="width:${util || 0}%"></i></div>
            <div class="metric-row" style="margin-top:6px"><span class="k">MEM</span><span class="v"><b>${ctx.fmt.bytes((g.memUsed || 0) * MiB)}</b><span style="color:var(--text-dim)"> / ${ctx.fmt.bytes((g.memTotal || 0) * MiB)} · ${Math.round(memPct)}%</span></span></div>
            <div class="bar"><i style="width:${memPct}%"></i></div>
            <div class="metric-row" style="margin-top:6px"><span class="k">TEMP · POWER</span><span class="v"><span class="apw-chip ${tCls}">${g.temp != null ? g.temp + "°C" : "n/a"}</span><span style="color:var(--text-dim);margin-left:8px">${esc(pw)}</span></span></div>`;
        }).join("");

        ctx.setStatus(ctx.remote ? "● " + (ctx.host && ctx.host.label ? ctx.host.label : "") : "");
        ctx.graph('[data-ref="g"]', "gpu", { min: 0, max: 100 });
    },
});
