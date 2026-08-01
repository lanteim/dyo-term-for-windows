"use strict";
// A.Petrov-style Memory widget: RAM used/free/active/avail, buffers/cache,
// swap, a used-percent bar, live graph, and top processes by memory.
window.APWidget.define({
    id: "ap-mem",
    title: "ap.mem.title",
    category: "apetrov",
    description: "RAM · swap · cache/buffers · live graph · top processes",
    defaultSize: { w: 6, h: 6 },
    interval: 2000,
    ranges: true,
    i18n: { en: { "ap.mem.title": "Memory · A.Petrov" }, ru: { "ap.mem.title": "Память · A.Petrov" } },
    settings: [
        { key: "interval", label: "Refresh interval (ms)", type: "number", default: 2000 },
        { key: "topN", label: "Top processes", type: "number", default: 5 },
    ],
    render(ctx) {
        ctx.body.innerHTML = `
            <div class="metric-row"><span class="k">USED</span><span class="v"><b data-ref="pct">--</b>%<span data-ref="abs" style="color:var(--text-dim);margin-left:8px"></span></span></div>
            <div class="bar"><i data-ref="bar"></i></div>
            <canvas class="apw-graph" data-ref="g" style="margin-top:8px"></canvas>
            <div class="apw-th">BREAKDOWN</div>
            <div class="apw-kv" data-ref="kv"></div>
            <div class="apw-th">SWAP</div>
            <div class="metric-row"><span class="k"><span class="apw-chip" data-ref="swchip">swap</span></span><span class="v"><b data-ref="swpct">0</b>%<span data-ref="swabs" style="color:var(--text-dim);margin-left:8px"></span></span></div>
            <div class="bar"><i data-ref="swbar"></i></div>
            <div class="apw-th">TOP BY MEMORY</div>
            <table><tbody data-ref="top"></tbody></table>`;
    },
    redraw(ctx) { ctx.graph('[data-ref="g"]', "mem", { min: 0, max: 100 }); },
    async update(ctx) {
        const [mem, procs] = await Promise.all([ctx.si("mem"), ctx.si("processes")]);
        if (!mem || !mem.total) return ctx.notAvailable("Memory stats not available on this host");
        const b = ctx.fmt.bytes;

        // used-percent bar + graph (used = total - free, includes buffers/cache)
        const used = mem.used != null ? mem.used : (mem.total - mem.free);
        const pct = Math.max(0, Math.min(100, (used / mem.total) * 100));
        ctx.ref.pct.textContent = Math.round(pct);
        ctx.ref.bar.style.width = pct + "%";
        ctx.ref.abs.textContent = b(used) + " / " + b(mem.total);
        ctx.push("mem", pct);

        // detailed breakdown
        const cache = mem.cached != null ? mem.cached : (mem.buffcache || 0);
        const rows = [
            ["Used", used], ["Free", mem.free], ["Active", mem.active],
            ["Available", mem.available], ["Buffers", mem.buffers], ["Cache", cache],
        ];
        ctx.ref.kv.innerHTML = rows.map(([k, v]) =>
            `<span class="k">${k}</span><span class="v"><b>${b(v || 0)}</b></span>`).join("");

        // swap
        const swTot = mem.swaptotal || 0, swUsed = mem.swapused || 0;
        const swPct = swTot ? Math.max(0, Math.min(100, (swUsed / swTot) * 100)) : 0;
        ctx.ref.swpct.textContent = Math.round(swPct);
        ctx.ref.swbar.style.width = swPct + "%";
        ctx.ref.swabs.textContent = swTot ? b(swUsed) + " / " + b(swTot) : "no swap";
        ctx.ref.swchip.className = "apw-chip " + (!swTot ? "" : swPct > 50 ? "err" : swPct > 10 ? "warn" : "ok");

        // top processes by mem field (percent)
        const n = Math.max(1, Number(ctx.settings.topN) || 5);
        const list = (procs.list || []).slice().sort((a, b2) => (b2.mem || 0) - (a.mem || 0)).slice(0, n);
        ctx.ref.top.innerHTML = list.map(p =>
            `<tr><td>${ctx.fmt.esc((p.name || "").slice(0, 20))}</td><td style="color:var(--text-dim)">${p.pid}</td><td style="text-align:right"><b style="color:var(--accent)">${(p.mem || 0).toFixed(1)}%</b></td></tr>`).join("");

        ctx.graph('[data-ref="g"]', "mem", { min: 0, max: 100 });
    },
});
