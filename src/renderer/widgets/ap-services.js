"use strict";
// A.Petrov-style Services widget: systemd units via systemctl — load/active/sub,
// status chips, a failed count, and a name filter. Degrades on non-systemd hosts.
window.APWidget.define({
    id: "ap-services",
    title: "ap.services.title",
    category: "apetrov",
    description: "systemd services · load/active/sub · failed count",
    defaultSize: { w: 6, h: 6 },
    interval: 5000,
    ranges: false,
    i18n: {
        en: { "ap.services.title": "Services · A.Petrov" },
        ru: { "ap.services.title": "Services · A.Petrov" },
    },
    settings: [
        { key: "interval", label: "Refresh interval (ms)", type: "number", default: 5000 },
        { key: "filter", label: "Filter by name", type: "text", default: "" },
    ],
    render(ctx) {
        ctx.body.innerHTML = `
            <div class="metric-row">
                <span class="k">SERVICES</span>
                <span class="v">
                    <span class="apw-chip ok" data-ref="cRun">running 0</span>
                    <span class="apw-chip" data-ref="cTot">total 0</span>
                    <span class="apw-chip" data-ref="cFail">failed 0</span>
                </span>
            </div>
            <div class="apw-th">UNITS</div>
            <table><thead><tr>
                <th style="text-align:left">UNIT</th>
                <th style="text-align:left">LOAD</th>
                <th style="text-align:left">ACTIVE</th>
                <th style="text-align:left">SUB</th>
            </tr></thead><tbody data-ref="rows"></tbody></table>`;
    },
    async update(ctx) {
        const esc = ctx.fmt.esc;

        // ── primary list; missing systemctl (macOS/Windows) → not available ──
        let res;
        try {
            res = await ctx.exec("systemctl",
                ["list-units", "--type=service", "--no-pager", "--no-legend", "--plain"],
                { timeout: 8000 });
        } catch (e) { res = null; }
        if (!res || res.code !== 0) {
            return ctx.notAvailable("systemctl not available — systemd/Linux only");
        }

        // ── failed units (name set) via `systemctl --failed` ──
        let failed = [];
        try {
            const rf = await ctx.exec("systemctl",
                ["--failed", "--type=service", "--no-pager", "--no-legend", "--plain"],
                { timeout: 8000 });
            if (rf && rf.code === 0) {
                failed = (rf.stdout || "").split("\n").map(l => l.trim()).filter(Boolean)
                    .map(l => l.split(/\s+/)[0]);
            }
        } catch (e) { /* keep failed empty */ }
        const failedSet = new Set(failed);

        // ── parse UNIT LOAD ACTIVE SUB [DESCRIPTION…] ──
        const all = (res.stdout || "").split("\n").map(l => l.trim()).filter(Boolean).map(l => {
            const c = l.split(/\s+/);
            return { name: c[0] || "", load: c[1] || "", active: c[2] || "", sub: c[3] || "" };
        });

        const f = String(ctx.settings.filter || "").trim().toLowerCase();
        const rows = f ? all.filter(r => r.name.toLowerCase().includes(f)) : all;

        // ── summary chips ──
        const running = rows.filter(r => r.active === "active").length;
        const total = rows.length;
        const failedN = failed.length;
        ctx.ref.cRun.textContent = "running " + running;
        ctx.ref.cTot.textContent = "total " + total;
        ctx.ref.cFail.textContent = "failed " + failedN;
        ctx.ref.cFail.className = "apw-chip " + (failedN ? "err" : "ok");

        // ── the list ──
        if (!rows.length) {
            ctx.ref.rows.innerHTML = `<tr><td colspan="4" style="color:var(--text-dim);padding:6px">${f ? "no services match \"" + esc(f) + "\"" : "no services"}</td></tr>`;
        } else {
            ctx.ref.rows.innerHTML = rows.slice(0, 300).map(r => {
                const fail = r.active === "failed" || failedSet.has(r.name);
                const cls = fail ? "err" : (r.active === "active" ? "ok" : "warn");
                return `<tr>
                    <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}</td>
                    <td style="color:var(--text-dim)">${esc(r.load)}</td>
                    <td><span class="apw-chip ${cls}">${esc(r.active)}</span></td>
                    <td style="color:var(--text-dim)">${esc(r.sub)}</td></tr>`;
            }).join("");
        }

        ctx.setStatus(`${total} service${total === 1 ? "" : "s"}` + (f ? ` matching "${f}"` : "") + (failedN ? ` · ${failedN} failed` : ""),
            failedN ? "err" : "");
    },
});
