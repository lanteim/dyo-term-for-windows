"use strict";
// A.Petrov-style MySQL / MariaDB widget: threads connected/running, slow queries,
// InnoDB buffer-pool usage, replica lag. Connects via ctx.db (mysql driver) and
// degrades to a "configure me" state until host/user are set in settings.

const AP_MYSQL_SKELETON = `
    <div class="metric-row"><span class="k">THREADS CONNECTED</span><span class="v"><b data-ref="conn">--</b><span data-ref="running" style="color:var(--text-dim);margin-left:8px"></span></span></div>
    <canvas class="apw-graph" data-ref="g" style="margin-top:8px"></canvas>
    <div class="apw-th">INNODB BUFFER POOL</div>
    <div class="metric-row"><span class="k">USED</span><span class="v"><b data-ref="bppct">--</b>%<span data-ref="bpabs" style="color:var(--text-dim);margin-left:8px"></span></span></div>
    <div class="bar"><i data-ref="bpbar"></i></div>
    <div class="apw-th">STATUS</div>
    <div class="apw-kv" data-ref="kv"></div>
    <div class="apw-th">REPLICATION</div>
    <div class="metric-row"><span class="k"><span class="apw-chip" data-ref="repchip">replica</span></span><span class="v"><b data-ref="lag">--</b><span data-ref="laglabel" style="color:var(--text-dim);margin-left:6px"></span></span></div>`;

// SHOW REPLICA STATUS (8.0.22+/MariaDB 10.5+) with a fall-back to SHOW SLAVE STATUS.
// Empty result set → this server is a source, not a replica.
async function apMysqlReplica(ctx) {
    for (const q of ["SHOW REPLICA STATUS", "SHOW SLAVE STATUS"]) {
        const r = await ctx.db.query(ctx._connId, q);
        if (!r || r.error) continue;
        if (!r.rows || !r.rows.length) return { role: "source", lag: null };
        const row = r.rows[0];
        const v = row.Seconds_Behind_Master != null ? row.Seconds_Behind_Master : row.Seconds_Behind_Source;
        return { role: "replica", lag: v == null ? null : Number(v) };
    }
    return null; // neither statement is supported / permitted
}

window.APWidget.define({
    id: "ap-mysql",
    title: "ap.mysql.title",
    category: "apetrov",
    description: "MySQL / MariaDB · threads · slow queries · InnoDB buffer pool · replica lag",
    defaultSize: { w: 6, h: 6 },
    interval: 4000,
    ranges: true,
    i18n: {
        en: { "ap.mysql.title": "MySQL / MariaDB · A.Petrov" },
        ru: { "ap.mysql.title": "MySQL / MariaDB · A.Petrov" },
    },
    settings: [
        { key: "interval", label: "Refresh interval (ms)", type: "number", default: 4000 },
        { key: "host", label: "Host", type: "text", default: "127.0.0.1" },
        { key: "port", label: "Port", type: "number", default: 3306 },
        { key: "user", label: "User", type: "text", default: "" },
        { key: "password", label: "Password", type: "text", default: "" },
        { key: "database", label: "Database (optional)", type: "text", default: "" },
    ],
    render(ctx) { ctx.body.innerHTML = AP_MYSQL_SKELETON; },
    redraw(ctx) { ctx.graph('[data-ref="g"]', "conns", { min: 0 }); },
    // drop any live connection when credentials change so we reconnect fresh
    onSettings(ctx) { if (ctx._connId) { const id = ctx._connId; ctx._connId = null; ctx.db.close(id); } },
    async update(ctx) {
        const s = ctx.settings;
        if (!s.host || !s.user) {
            ctx._connId = null;
            return ctx.notAvailable("Set host / user / password in settings to monitor MySQL / MariaDB");
        }
        // rebuild static DOM if a prior notAvailable() wiped it
        if (!ctx.$('[data-ref="conn"]')) { ctx.body.innerHTML = AP_MYSQL_SKELETON; ctx.bindRefs(); }

        // lazily open (and cache) a connection
        if (!ctx._connId) {
            const res = await ctx.db.connect({
                type: "mysql", host: s.host, port: Number(s.port) || 3306,
                user: s.user, password: s.password, database: s.database || undefined,
            });
            if (!res || res.error) return ctx.notAvailable("Cannot connect: " + ((res && res.error) || "connection failed"));
            ctx._connId = res.id;
            ctx._ver = String(res.version || "mysql").split(/[,(]/)[0].trim();
        }

        const st = await ctx.db.query(ctx._connId, "SHOW GLOBAL STATUS");
        if (!st || st.error) {                 // connection likely dropped — reset & degrade
            if (ctx._connId) ctx.db.close(ctx._connId);
            ctx._connId = null;
            return ctx.setStatus((st && st.error) || "query failed", "err");
        }
        const map = {};
        (st.rows || []).forEach(r => {
            const k = r.Variable_name != null ? r.Variable_name : r.variable_name;
            map[String(k)] = r.Value != null ? r.Value : r.value;
        });
        const num = k => Number(map[k] || 0);

        // threads
        const conn = num("Threads_connected"), running = num("Threads_running");
        ctx.ref.conn.textContent = ctx.fmt.num(conn);
        ctx.ref.running.textContent = "· " + ctx.fmt.num(running) + " running";
        ctx.push("conns", conn);
        ctx.graph('[data-ref="g"]', "conns", { min: 0 });

        // InnoDB buffer pool (pages → percent + absolute bytes)
        const bpData = num("Innodb_buffer_pool_pages_data");
        const bpTotal = num("Innodb_buffer_pool_pages_total");
        const bpBytes = num("Innodb_buffer_pool_bytes_data");
        if (bpTotal > 0) {
            const pct = Math.max(0, Math.min(100, bpData / bpTotal * 100));
            const pageSz = bpData > 0 ? bpBytes / bpData : 16384;
            ctx.ref.bppct.textContent = Math.round(pct);
            ctx.ref.bpbar.style.width = pct + "%";
            ctx.ref.bpabs.textContent = ctx.fmt.bytes(bpData * pageSz) + " / " + ctx.fmt.bytes(bpTotal * pageSz);
        } else {
            ctx.ref.bppct.textContent = "n/a";
            ctx.ref.bpbar.style.width = "0%";
            ctx.ref.bpabs.textContent = "InnoDB not available";
        }

        // status breakdown
        ctx.ref.kv.innerHTML = [
            ["Threads running", ctx.fmt.num(running)],
            ["Slow queries", ctx.fmt.num(num("Slow_queries"))],
            ["Questions", ctx.fmt.num(num("Questions"))],
            ["Uptime", ctx.fmt.duration(num("Uptime"))],
        ].map(([k, v]) => `<span class="k">${k}</span><span class="v"><b>${v}</b></span>`).join("");

        // replication lag
        const rep = await apMysqlReplica(ctx);
        if (!rep) {
            ctx.ref.repchip.className = "apw-chip";
            ctx.ref.repchip.textContent = "replica";
            ctx.ref.lag.textContent = "n/a";
            ctx.ref.laglabel.textContent = "no privilege";
        } else if (rep.role === "source") {
            ctx.ref.repchip.className = "apw-chip";
            ctx.ref.repchip.textContent = "source";
            ctx.ref.lag.textContent = "—";
            ctx.ref.laglabel.textContent = "not a replica";
        } else {
            const lag = rep.lag;
            const bad = lag == null ? "err" : lag > 60 ? "err" : lag > 5 ? "warn" : "ok";
            ctx.ref.repchip.className = "apw-chip " + bad;
            ctx.ref.repchip.textContent = "replica";
            ctx.ref.lag.textContent = lag == null ? "NULL" : ctx.fmt.num(lag);
            ctx.ref.laglabel.textContent = lag == null ? "replication stopped" : "seconds behind";
        }

        ctx.setStatus(`${ctx._ver} · ${conn} conn · ${new Date().toLocaleTimeString()}`, "");
    },
});
