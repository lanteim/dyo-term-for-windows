"use strict";
// A.Petrov-style CPU widget: total load, per-core bars, live graph, top procs.
window.APWidget.define({
    id: "ap-cpu",
    title: "ap.cpu.title",
    category: "apetrov",
    description: "CPU load · per-core · live graph · top processes",
    defaultSize: { w: 6, h: 6 },
    interval: 2000,
    ranges: true,
    i18n: { en: { "ap.cpu.title": "CPU · A.Petrov" }, ru: { "ap.cpu.title": "CPU · A.Petrov" } },
    settings: [
        { key: "interval", label: "Refresh interval (ms)", type: "number", default: 2000 },
        { key: "topN", label: "Top processes", type: "number", default: 5 },
    ],
    render(ctx) {
        ctx.body.innerHTML = `
            <div class="metric-row"><span class="k">TOTAL</span><span class="v"><b data-ref="tot">--</b>%<span data-ref="avg" style="color:var(--text-dim);margin-left:8px"></span></span></div>
            <div class="bar"><i data-ref="totbar"></i></div>
            <canvas class="apw-graph" data-ref="g" style="margin-top:8px"></canvas>
            <div class="apw-th">CORES</div>
            <div class="apw-cores" data-ref="cores"></div>
            <div class="apw-th">TOP BY CPU</div>
            <table><tbody data-ref="top"></tbody></table>`;
    },
    redraw(ctx) { ctx.graph('[data-ref="g"]', "cpu", { min: 0, max: 100 }); },
    async update(ctx) {
        const topN = Math.max(1, Number(ctx.settings.topN) || 5);
        // Remote (active tab is ssh'd somewhere) → read that server's /proc.
        if (ctx.remote) {
            const d = await window.APRemote.cpu(ctx);
            if (!d || d.error) return ctx.setStatus((ctx.host && ctx.host.label ? ctx.host.label + ": " : "") + ((d && d.error) || "no data"), "err");
            const total = Math.round(d.total);
            ctx.ref.tot.textContent = total;
            ctx.ref.totbar.style.width = total + "%";
            ctx.ref.avg.textContent = "avg " + (d.avg || 0).toFixed(2) + " · " + d.nproc + " cores";
            ctx.push("cpu", total);
            ctx.ref.cores.innerHTML = d.cores.map((c, i) => { const p = Math.round(c.load); return `<div class="apw-core">C${i}<div class="bar"><i style="width:${p}%"></i></div>${p}%</div>`; }).join("");
            ctx.ref.top.innerHTML = (d.procs || []).slice(0, topN).map(p =>
                `<tr><td>${ctx.fmt.esc((p.name || "").slice(0, 20))}</td><td style="color:var(--text-dim)">${p.pid}</td><td style="text-align:right"><b style="color:var(--accent)">${(p.cpu || 0).toFixed(1)}%</b></td></tr>`).join("");
            ctx.setStatus("● " + (ctx.host && ctx.host.label ? ctx.host.label : ""));
            ctx.graph('[data-ref="g"]', "cpu", { min: 0, max: 100 });
            return;
        }
        const [load, procs] = await Promise.all([ctx.si("currentLoad"), ctx.si("processes")]);
        const total = Math.round(load.currentLoad || 0);
        ctx.ref.tot.textContent = total;
        ctx.ref.totbar.style.width = total + "%";
        ctx.ref.avg.textContent = load.avgLoad != null ? "avg " + load.avgLoad.toFixed(2) : "";
        ctx.push("cpu", total);

        const cores = load.cpus || [];
        ctx.ref.cores.innerHTML = cores.map((c, i) => {
            const p = Math.round(c.load || 0);
            return `<div class="apw-core">C${i}<div class="bar"><i style="width:${p}%"></i></div>${p}%</div>`;
        }).join("");

        const n = Math.max(1, Number(ctx.settings.topN) || 5);
        const list = (procs.list || []).slice().sort((a, b) => (b.cpu || 0) - (a.cpu || 0)).slice(0, n);
        ctx.ref.top.innerHTML = list.map(p =>
            `<tr><td>${ctx.fmt.esc((p.name || "").slice(0, 20))}</td><td style="color:var(--text-dim)">${p.pid}</td><td style="text-align:right"><b style="color:var(--accent)">${(p.cpu || 0).toFixed(1)}%</b></td></tr>`).join("");

        ctx.graph('[data-ref="g"]', "cpu", { min: 0, max: 100 });
    },
});
