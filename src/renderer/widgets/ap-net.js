"use strict";
// A.Petrov-style Network widget: rx/tx speed, totals, errors, live dual graph,
// interface list and active connection count — all from systeminformation.
window.APWidget.define({
    id: "ap-net",
    title: "ap.net.title",
    category: "apetrov",
    description: "Network throughput · totals · errors · interfaces · connections",
    defaultSize: { w: 6, h: 6 },
    interval: 2000,
    ranges: true,
    i18n: {
        en: { "ap.net.title": "Network · A.Petrov" },
        ru: { "ap.net.title": "Сеть · A.Petrov" },
    },
    settings: [
        { key: "interval", label: "Refresh interval (ms)", type: "number", default: 2000 },
    ],
    render(ctx) {
        ctx.body.innerHTML = `
            <div class="metric-row"><span class="k">PRIMARY</span><span class="v"><b data-ref="iface">--</b> <span class="apw-chip" data-ref="state">--</span></span></div>
            <div class="apw-kv">
                <span class="k">&#9660; RX</span><span class="v"><b data-ref="rx">--</b></span>
                <span class="k">&#9650; TX</span><span class="v"><b data-ref="tx">--</b></span>
                <span class="k">RX total</span><span class="v" data-ref="rxtot">--</span>
                <span class="k">TX total</span><span class="v" data-ref="txtot">--</span>
                <span class="k">Errors</span><span class="v"><span class="apw-chip" data-ref="errs">--</span></span>
                <span class="k">Connections</span><span class="v"><b data-ref="conns">--</b></span>
            </div>
            <div class="apw-th">&#9660; RX / &#9650; TX (bytes/s)</div>
            <canvas class="apw-graph" data-ref="grx"></canvas>
            <canvas class="apw-graph" data-ref="gtx"></canvas>
            <div class="apw-th">Interfaces</div>
            <table><tbody data-ref="ifaces"></tbody></table>`;
    },
    redraw(ctx) { drawBoth(ctx); },
    async update(ctx) {
        const [statsRaw, ifacesRaw, connsRaw, def] = await Promise.all([
            ctx.si("networkStats"),
            ctx.si("networkInterfaces"),
            ctx.si("networkConnections"),
            ctx.si("networkInterfaceDefault").catch(() => null),
        ]);
        const stats = Array.isArray(statsRaw) ? statsRaw : (statsRaw ? [statsRaw] : []);
        if (!stats.length) { ctx.notAvailable("Network stats unavailable on this host"); return; }

        // pick the primary interface: default iface → busiest → first
        const defName = typeof def === "string" ? def : (def && def.iface) || null;
        const bytes = s => (Number(s.rx_bytes) || 0) + (Number(s.tx_bytes) || 0);
        const primary = stats.find(s => s.iface === defName)
            || stats.slice().sort((a, b) => bytes(b) - bytes(a))[0]
            || stats[0];

        const rxSec = Math.max(0, Number(primary.rx_sec) || 0);
        const txSec = Math.max(0, Number(primary.tx_sec) || 0);
        ctx.ref.iface.textContent = primary.iface || "—";
        const up = primary.operstate === "up" || primary.rx_sec != null;
        ctx.ref.state.textContent = primary.operstate || (up ? "up" : "down");
        ctx.ref.state.className = "apw-chip " + (up ? "ok" : "err");
        ctx.ref.rx.textContent = ctx.fmt.bps(rxSec);
        ctx.ref.tx.textContent = ctx.fmt.bps(txSec);
        ctx.ref.rxtot.textContent = ctx.fmt.bytes(primary.rx_bytes);
        ctx.ref.txtot.textContent = ctx.fmt.bytes(primary.tx_bytes);

        const rxE = Number(primary.rx_errors) || 0, txE = Number(primary.tx_errors) || 0;
        ctx.ref.errs.textContent = `${ctx.fmt.num(rxE)} rx / ${ctx.fmt.num(txE)} tx`;
        ctx.ref.errs.className = "apw-chip " + (rxE + txE > 0 ? "err" : "ok");

        const conns = Array.isArray(connsRaw) ? connsRaw.length : 0;
        ctx.ref.conns.textContent = ctx.fmt.num(conns);

        ctx.push("rx", rxSec);
        ctx.push("tx", txSec);

        // interface list — active/up + addressed first
        const ifaces = (Array.isArray(ifacesRaw) ? ifacesRaw : (ifacesRaw ? [ifacesRaw] : []))
            .map(x => ({ iface: x.iface || x.ifaceName || "", ip4: x.ip4 || "", state: x.operstate || (x.default ? "up" : "") || "" }))
            .filter(x => x.iface)
            .sort((a, b) => (b.ip4 ? 1 : 0) - (a.ip4 ? 1 : 0));
        ctx.ref.ifaces.innerHTML = ifaces.slice(0, 12).map(x => {
            const isUp = String(x.state).toLowerCase() === "up";
            const cls = x.iface === (primary.iface) ? "ok" : (isUp ? "" : "err");
            return `<tr><td><b style="color:var(--accent)">${ctx.fmt.esc(x.iface)}</b></td>`
                + `<td style="color:var(--accent2)">${ctx.fmt.esc(x.ip4 || "—")}</td>`
                + `<td style="text-align:right"><span class="apw-chip ${cls}">${ctx.fmt.esc(x.state || "—")}</span></td></tr>`;
        }).join("");

        drawBoth(ctx);
    },
});

// shared y-scale so the RX and TX graphs are directly comparable
function drawBoth(ctx) {
    let hi = 0;
    for (const p of ctx.series("rx")) if (p.v > hi) hi = p.v;
    for (const p of ctx.series("tx")) if (p.v > hi) hi = p.v;
    const opts = { min: 0, max: hi > 0 ? hi * 1.15 : 1024 };
    ctx.graph('[data-ref="grx"]', "rx", opts);
    ctx.graph('[data-ref="gtx"]', "tx", opts);
}
