"use strict";
// A.Petrov-style PostgreSQL widget: connections, long-running queries, locks,
// replication and database size via ctx.db (pg_stat_* / pg_locks / pg_database_size).
// Caches the connection id on ctx; reconnects when settings change or a query drops.

function paint(ctx) {
    ctx.body.innerHTML = `
        <div class="metric-row"><span class="k">ACTIVE / TOTAL</span>
            <span class="v"><b data-ref="active">--</b> / <span data-ref="total">--</span></span></div>
        <div class="bar"><i data-ref="bar"></i></div>
        <canvas class="apw-graph" data-ref="g" style="margin-top:8px"></canvas>
        <div class="apw-th">STATS</div>
        <div class="apw-kv">
            <div class="k" data-ref="slowk">Long-running</div><div class="v"><b data-ref="slow">--</b></div>
            <div class="k">Locks held</div><div class="v"><b data-ref="locks">--</b></div>
            <div class="k">Locks not granted</div><div class="v"><b data-ref="ungr">--</b></div>
            <div class="k">Replication clients</div><div class="v"><b data-ref="repl">--</b></div>
            <div class="k">Database size</div><div class="v"><b data-ref="dbsize">--</b></div>
        </div>
        <div class="apw-th">LONG-RUNNING QUERIES</div>
        <table><tbody data-ref="rows"></tbody></table>`;
    ctx.bindRefs();
}

window.APWidget.define({
    id: "ap-postgres",
    title: "ap.postgres.title",
    category: "apetrov",
    description: "PostgreSQL · connections · long queries · locks · replication · size",
    defaultSize: { w: 6, h: 6 },
    interval: 5000,
    ranges: true,
    i18n: {
        en: { "ap.postgres.title": "PostgreSQL · A.Petrov" },
        ru: { "ap.postgres.title": "PostgreSQL · A.Petrov" },
    },
    settings: [
        { key: "interval", label: "Refresh interval (ms)", type: "number", default: 5000 },
        { key: "host", label: "Host", type: "text", default: "" },
        { key: "port", label: "Port", type: "number", default: 5432 },
        { key: "user", label: "User", type: "text", default: "" },
        { key: "password", label: "Password", type: "text", default: "" },
        { key: "database", label: "Database", type: "text", default: "" },
        { key: "slowSec", label: "Long-running threshold (s)", type: "number", default: 30 },
    ],
    render(ctx) { paint(ctx); },
    redraw(ctx) { ctx.graph('[data-ref="g"]', "active", { min: 0 }); },
    async update(ctx) {
        const S = ctx.settings;
        const pg = ctx._pg || (ctx._pg = { id: null, sig: "" });
        const host = String(S.host || "").trim();

        // Not configured yet → gentle prompt, drop any stale connection.
        if (!host) {
            if (pg.id) { ctx.db.close(pg.id); pg.id = null; }
            return ctx.notAvailable("Set the PostgreSQL host in this widget's settings to connect.");
        }

        const cfg = {
            type: "postgres", host, port: Number(S.port) || 5432,
            user: String(S.user || "").trim(), password: String(S.password || ""),
            database: String(S.database || "").trim(),
        };
        const sig = JSON.stringify([cfg.host, cfg.port, cfg.user, cfg.password, cfg.database]);
        if (pg.id && sig !== pg.sig) { ctx.db.close(pg.id); pg.id = null; }

        // Connect (cache the id) — connect error degrades to a message, never throws.
        if (!pg.id) {
            const res = await ctx.db.connect(cfg).catch(e => ({ error: (e && e.message) || String(e) }));
            if (!res || res.error || !res.id) {
                return ctx.notAvailable("Cannot connect: " + ctx.fmt.esc((res && res.error) || "unknown error"));
            }
            pg.id = res.id; pg.sig = sig; pg.version = String(res.version || "PostgreSQL").split(/[,(]/)[0].trim();
        }

        const slow = Math.max(1, Math.floor(Number(S.slowSec) || 30));
        const stat = await ctx.db.query(pg.id, `
            SELECT
              (SELECT count(*) FROM pg_stat_activity WHERE state='active') AS active,
              (SELECT count(*) FROM pg_stat_activity) AS total,
              (SELECT count(*) FROM pg_stat_activity WHERE state='active'
                 AND query_start IS NOT NULL AND now()-query_start > interval '${slow} seconds') AS slow,
              (SELECT count(*) FROM pg_locks) AS locks,
              (SELECT count(*) FROM pg_locks WHERE NOT granted) AS ungranted,
              (SELECT count(*) FROM pg_stat_replication) AS repl,
              pg_database_size(current_database()) AS dbsize`);

        // Query failure usually means the socket died — drop id so we reconnect next tick.
        if (!stat || stat.error || !(stat.rows && stat.rows.length)) {
            if (pg.id) { ctx.db.close(pg.id); pg.id = null; }
            return ctx.setStatus(ctx.fmt.esc((stat && stat.error) || "query failed"), "err");
        }

        // notAvailable may have wiped the DOM on a prior tick — rebuild before writing.
        if (!ctx.ref.active || !ctx.body.contains(ctx.ref.active)) paint(ctx);

        const r = stat.rows[0];
        const active = Number(r.active) || 0, total = Number(r.total) || 0;
        ctx.ref.active.textContent = active;
        ctx.ref.total.textContent = total;
        ctx.ref.bar.style.width = (total ? Math.round((active / total) * 100) : 0) + "%";
        ctx.ref.slowk.textContent = `Long-running (>${slow}s)`;
        ctx.ref.slow.textContent = Number(r.slow) || 0;
        ctx.ref.locks.textContent = Number(r.locks) || 0;
        ctx.ref.ungr.textContent = Number(r.ungranted) || 0;
        ctx.ref.repl.textContent = Number(r.repl) || 0;
        ctx.ref.dbsize.textContent = ctx.fmt.bytes(Number(r.dbsize) || 0);

        ctx.push("active", active);
        ctx.graph('[data-ref="g"]', "active", { min: 0 });

        // Detail: the slowest active queries currently running.
        const list = await ctx.db.query(pg.id, `
            SELECT pid, usename, round(extract(epoch FROM now()-query_start))::int AS secs, query
            FROM pg_stat_activity
            WHERE state='active' AND query_start IS NOT NULL
              AND now()-query_start > interval '${slow} seconds' AND pid <> pg_backend_pid()
            ORDER BY query_start ASC LIMIT 8`);
        const rows = (list && !list.error && list.rows) || [];
        ctx.ref.rows.innerHTML = rows.length
            ? rows.map(x => `<tr>
                <td style="color:var(--text-dim)">${ctx.fmt.esc(x.pid)}</td>
                <td><span class="apw-chip warn">${ctx.fmt.duration(x.secs)}</span></td>
                <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ctx.fmt.esc(String(x.query || "").replace(/\s+/g, " ").slice(0, 120))}</td></tr>`).join("")
            : `<tr><td style="color:var(--text-dim);padding:4px">none</td></tr>`;

        ctx.setStatus(`● ${pg.version} · ${cfg.host}:${cfg.port}/${cfg.database || "-"}`);
    },
});
