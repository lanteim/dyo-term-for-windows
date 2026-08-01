"use strict";
// A.Petrov-style ClickHouse widget: queries/sec live graph, background merges &
// mutations, replication health, tracked memory — over the HTTP interface via
// ctx.db (type "clickhouse"). Degrades to notAvailable until a host is set.

const AP_CH_SKELETON = `
    <div class="metric-row"><span class="k">QUERIES / S</span><span class="v"><b data-ref="qps">--</b> q/s<span data-ref="qrun" style="color:var(--text-dim);margin-left:8px"></span></span></div>
    <canvas class="apw-graph" data-ref="g"></canvas>
    <div class="metric-row"><span class="k">MEMORY (tracked)</span><span class="v"><b data-ref="mem">--</b></span></div>
    <div class="apw-th">Background</div>
    <div data-ref="bg"></div>
    <div class="apw-th">Replication</div>
    <div data-ref="replchip" style="margin-bottom:6px"></div>
    <div class="apw-kv">
        <span class="k">Replicated tables</span><span class="v"><b data-ref="rtotal">--</b></span>
        <span class="k">Read-only</span><span class="v" data-ref="rro">--</span>
        <span class="k">Queue size</span><span class="v" data-ref="rqueue">--</span>
        <span class="k">Future parts</span><span class="v" data-ref="rfuture">--</span>
        <span class="k">Max delay</span><span class="v" data-ref="rdelay">--</span>
    </div>
    <div class="apw-th">Server</div>
    <div class="apw-kv">
        <span class="k">Version</span><span class="v" data-ref="ver">--</span>
        <span class="k">Uptime</span><span class="v" data-ref="uptime">--</span>
    </div>`;

// One round-trip: scalar subqueries keep it to a single statement (the driver
// speaks one query per call). Aggregates always return exactly one row, so an
// empty system.events/replicas never errors the scalar subquery.
const AP_CH_SQL = `SELECT
    (SELECT sum(value) FROM system.events WHERE event = 'Query') AS q_total,
    (SELECT sum(value) FROM system.metrics WHERE metric = 'Query') AS q_running,
    (SELECT sum(value) FROM system.metrics WHERE metric = 'MemoryTracking') AS mem,
    (SELECT count() FROM system.merges) AS merges,
    (SELECT count() FROM system.mutations WHERE is_done = 0) AS mutations,
    (SELECT count() FROM system.replicas) AS repl_total,
    (SELECT countIf(is_readonly) FROM system.replicas) AS repl_ro,
    (SELECT sum(queue_size) FROM system.replicas) AS repl_queue,
    (SELECT sum(future_parts) FROM system.replicas) AS repl_future,
    (SELECT max(absolute_delay) FROM system.replicas) AS repl_delay,
    uptime() AS uptime,
    version() AS version`;

// Reuse a connection across ticks; reconnect when settings change or it drops.
async function apChConn(ctx) {
    const s = ctx.settings, host = String(s.host || "").trim();
    if (!host) return { na: "Set the ClickHouse host in settings (gear icon) to begin." };
    const cfg = { type: "clickhouse", host, port: Number(s.port) || 8123, user: String(s.user || "default").trim(), password: s.password || "", database: String(s.database || "default").trim() };
    const key = JSON.stringify(cfg), st = ctx._ch;
    if (st.connId && st.key === key) return { id: st.connId };
    if (st.connId) { try { await ctx.db.close(st.connId); } catch (_) {} st.connId = null; st.prev = null; }
    const res = await ctx.db.connect(cfg).catch(e => ({ error: (e && e.message) || String(e) }));
    if (!res || res.error) return { na: "Cannot connect: " + ((res && res.error) || "connection failed") };
    st.connId = res.id; st.key = key; st.version = String(res.version || "ClickHouse");
    return { id: res.id };
}

window.APWidget.define({
    id: "ap-clickhouse",
    title: "ap.clickhouse.title",
    category: "apetrov",
    description: "ClickHouse · queries/sec · merges & mutations · replication · memory",
    defaultSize: { w: 6, h: 8 },
    interval: 3000,
    ranges: true,
    i18n: {
        en: { "ap.clickhouse.title": "ClickHouse · A.Petrov" },
        ru: { "ap.clickhouse.title": "ClickHouse · A.Petrov" },
    },
    settings: [
        { key: "interval", label: "Refresh interval (ms)", type: "number", default: 3000 },
        { key: "host", label: "Host", type: "text", default: "" },
        { key: "port", label: "HTTP port", type: "number", default: 8123 },
        { key: "user", label: "User", type: "text", default: "default" },
        { key: "password", label: "Password", type: "text", default: "" },
        { key: "database", label: "Database", type: "text", default: "default" },
    ],
    render(ctx) { ctx._ch = { connId: null, key: "", prev: null, version: "" }; ctx.body.innerHTML = AP_CH_SKELETON; },
    redraw(ctx) { ctx.graph('[data-ref="g"]', "chqps", { min: 0 }); },
    async update(ctx) {
        if (!ctx._ch) ctx._ch = { connId: null, key: "", prev: null, version: "" };
        const c = await apChConn(ctx);
        if (c.na) { ctx.notAvailable(c.na); return; }

        const r = await ctx.db.query(c.id, AP_CH_SQL).catch(e => ({ error: (e && e.message) || String(e) }));
        if (!r || r.error) { ctx._ch.connId = null; ctx._ch.prev = null; ctx.setStatus((r && r.error) || "query failed", "err"); return; }

        // rebuild the static DOM if a prior notAvailable() wiped it
        if (!ctx.$('[data-ref="g"]')) { ctx.body.innerHTML = AP_CH_SKELETON; ctx.bindRefs(); }
        const row = (r.rows && r.rows[0]) || {};
        const num = k => Number(row[k]) || 0; // JSON emits UInt64 as strings

        // queries/sec — derive from the cumulative Query counter delta
        const qTotal = num("q_total"), now = Date.now(), prev = ctx._ch.prev;
        let qps = 0, have = false;
        if (prev && qTotal >= prev.q) { const dt = (now - prev.t) / 1000; if (dt > 0) { qps = (qTotal - prev.q) / dt; have = true; } }
        ctx._ch.prev = { q: qTotal, t: now };
        ctx.ref.qps.textContent = have ? qps.toFixed(qps < 10 ? 1 : 0) : "…";
        const qrun = num("q_running");
        ctx.ref.qrun.textContent = qrun ? qrun + " running" : "";
        if (have) ctx.push("chqps", qps);
        ctx.graph('[data-ref="g"]', "chqps", { min: 0 });

        ctx.ref.mem.textContent = ctx.fmt.bytes(num("mem"));

        // background merges & mutations
        const merges = num("merges"), muts = num("mutations");
        ctx.ref.bg.innerHTML =
            `<span class="apw-chip ${merges ? "warn" : "ok"}" style="margin-right:4px">${merges} merges</span>`
            + `<span class="apw-chip ${muts ? "warn" : "ok"}">${muts} mutations</span>`;

        // replication health
        const rtotal = num("repl_total"), ro = num("repl_ro"), queue = num("repl_queue"), future = num("repl_future");
        const delay = row.repl_delay == null ? 0 : Number(row.repl_delay) || 0;
        ctx.ref.rtotal.textContent = rtotal;
        ctx.ref.rro.textContent = ro;
        ctx.ref.rro.style.color = ro ? "var(--danger)" : "";
        ctx.ref.rqueue.textContent = queue;
        ctx.ref.rfuture.textContent = future;
        ctx.ref.rdelay.textContent = delay > 0 ? ctx.fmt.duration(delay) : "0s";
        if (!rtotal) ctx.ref.replchip.innerHTML = `<span class="apw-chip">no replicated tables</span>`;
        else if (ro) ctx.ref.replchip.innerHTML = `<span class="apw-chip err">${ro} read-only</span>`;
        else if (queue > 50 || delay > 60) ctx.ref.replchip.innerHTML = `<span class="apw-chip warn">lagging · queue ${queue}</span>`;
        else ctx.ref.replchip.innerHTML = `<span class="apw-chip ok">${rtotal} replica${rtotal !== 1 ? "s" : ""} healthy</span>`;

        ctx.ref.ver.textContent = String(row.version || ctx._ch.version || "").replace(/^ClickHouse\s*/i, "") || "—";
        ctx.ref.uptime.textContent = ctx.fmt.duration(num("uptime"));
        ctx.setStatus(`${ctx._ch.version} · ${new Date().toLocaleTimeString()}`, "");
    },
});
