"use strict";
// A.Petrov-style Redis widget: memory, keys, ops/s, keyspace hit ratio, live graph.
// Talks to the redis driver in src/main/db.js via ctx.db; INFO is sent as a raw
// command and comes back as a single "value" cell (client.call("INFO")).
window.APWidget.define({
    id: "ap-redis",
    title: "ap.redis.title",
    category: "apetrov",
    description: "Redis · memory · keys · ops/s · hit ratio · live graph",
    defaultSize: { w: 6, h: 6 },
    interval: 2000,
    ranges: true,
    i18n: { en: { "ap.redis.title": "Redis · A.Petrov" }, ru: { "ap.redis.title": "Redis · A.Petrov" } },
    settings: [
        { key: "host", label: "Host", type: "text", default: "" },
        { key: "port", label: "Port", type: "number", default: 6379 },
        { key: "password", label: "Password", type: "text", default: "" },
        { key: "db", label: "DB index", type: "number", default: 0 },
        { key: "interval", label: "Refresh interval (ms)", type: "number", default: 2000 },
    ],
    render(ctx) {
        ctx._tpl = `
            <div class="metric-row"><span class="k">MEMORY</span><span class="v"><b data-ref="mem">--</b><span data-ref="memmax" style="color:var(--text-dim);margin-left:8px"></span></span></div>
            <div class="bar" data-ref="membarwrap"><i data-ref="membar"></i></div>
            <div class="metric-row"><span class="k">OPS/SEC</span><span class="v"><b data-ref="ops" style="color:var(--accent)">--</b></span></div>
            <canvas class="apw-graph" data-ref="g" style="margin-top:8px"></canvas>
            <div class="apw-th">KEYSPACE</div>
            <div class="apw-kv">
                <div class="k">Keys · db<span data-ref="dbn">0</span></div><div class="v"><b data-ref="keys">--</b></div>
                <div class="k">Hit ratio</div><div class="v"><b data-ref="hit">--</b> <span class="apw-chip" data-ref="hitchip">n/a</span></div>
                <div class="k">Hits / Misses</div><div class="v" data-ref="hm">--</div>
                <div class="k">Server</div><div class="v" data-ref="ver" style="color:var(--text-dim)">--</div>
            </div>`;
        ctx.body.innerHTML = ctx._tpl;
    },
    redraw(ctx) { ctx.graph('[data-ref="g"]', "ops", { min: 0 }); },
    onSettings(ctx) { if (ctx._connId) { try { ctx.db.close(ctx._connId); } catch (e) {} ctx._connId = null; } },
    async update(ctx) {
        const host = String(ctx.settings.host || "").trim();
        if (!host) { ctx._na = true; ctx.notAvailable("Set Redis host in settings to connect."); return; }
        // restore the DOM if notAvailable previously wiped it
        if (ctx._na) { ctx.body.innerHTML = ctx._tpl; ctx.bindRefs(); ctx._na = false; }

        // (re)connect lazily, reusing the live connection between ticks
        if (!ctx._connId) {
            const res = await ctx.db.connect({
                type: "redis", host,
                port: Number(ctx.settings.port) || 6379,
                password: String(ctx.settings.password || ""),
                database: Number(ctx.settings.db) || 0,
            });
            if (!res || res.error) { ctx._na = true; ctx.notAvailable("Redis unavailable: " + ((res && res.error) || "connection failed")); return; }
            ctx._connId = res.id; ctx._ver = res.version;
        }

        const r = await ctx.db.query(ctx._connId, "INFO");
        if (!r || r.error) { ctx._connId = null; ctx.setStatus((r && r.error) || "INFO failed", "err"); return; }
        const info = (r.rows && r.rows[0] && r.rows[0].value) || "";
        const get = k => { const m = new RegExp("^" + k + ":(.*)$", "m").exec(info); return m ? m[1].trim() : ""; };

        const usedH = get("used_memory_human") || ctx.fmt.bytes(Number(get("used_memory")) || 0);
        const maxMem = Number(get("maxmemory")) || 0;
        const ops = Number(get("instantaneous_ops_per_sec")) || 0;
        const hits = Number(get("keyspace_hits")) || 0;
        const misses = Number(get("keyspace_misses")) || 0;
        const total = hits + misses;
        const ratio = total > 0 ? (hits / total) * 100 : 0;
        const dbn = Number(ctx.settings.db) || 0;
        const km = /keys=(\d+)/.exec(get("db" + dbn));
        const keys = km ? Number(km[1]) : 0;

        // memory: show a usage bar only when a maxmemory limit is configured
        ctx.ref.mem.textContent = usedH;
        if (maxMem > 0) {
            const usedB = Number(get("used_memory")) || 0;
            ctx.ref.membarwrap.style.display = "";
            ctx.ref.membar.style.width = Math.min(100, (usedB / maxMem) * 100) + "%";
            ctx.ref.memmax.textContent = "/ " + (get("maxmemory_human") || ctx.fmt.bytes(maxMem));
        } else {
            ctx.ref.membarwrap.style.display = "none";
            ctx.ref.memmax.textContent = "no limit";
        }

        ctx.ref.ops.textContent = ctx.fmt.num(ops) + "/s";
        ctx.ref.dbn.textContent = dbn;
        ctx.ref.keys.textContent = ctx.fmt.num(keys);
        ctx.ref.hit.textContent = total > 0 ? ctx.fmt.pct(ratio) : "—";
        ctx.ref.hm.textContent = ctx.fmt.num(hits) + " / " + ctx.fmt.num(misses);
        ctx.ref.ver.textContent = ctx._ver || "";
        ctx.ref.hitchip.className = "apw-chip" + (total === 0 ? "" : ratio >= 90 ? " ok" : ratio >= 70 ? " warn" : " err");
        ctx.ref.hitchip.textContent = total === 0 ? "n/a" : ratio >= 90 ? "good" : ratio >= 70 ? "warn" : "low";

        ctx.push("ops", ops);
        ctx.graph('[data-ref="g"]', "ops", { min: 0 });
        ctx.setStatus("");
    },
});
