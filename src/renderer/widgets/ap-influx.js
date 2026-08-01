"use strict";
// A.Petrov-style InfluxDB widget: write/query rates · storage · shards · series
// cardinality, scraped from the Influx Prometheus /metrics endpoint (falls back
// to /debug/vars expvar). Degrades gracefully until a URL is set or on fetch error.
(function () {
    // Candidate metric names per stat (+ a case-insensitive regex fallback so the
    // widget still finds something across Influx 1.x/2.x and expvar naming).
    const M = {
        write:   { names: ["storage_writer_ok_points_total", "storage_points_written_total"], re: /writer_ok_points|points_written|pointswrittenok/i },
        query:   { names: ["qc_requests_total", "query_control_requests_total"], re: /qc_requests|queries?_?(executed|requests)|queryreq/i },
        storage: { names: ["storage_tsm_files_disk_bytes", "storage_bucket_disk_bytes"], re: /disk_?bytes|bytes_on_disk/i },
        shards:  { names: ["storage_shard_count", "influxdb_shard_count"], re: /shard.*(count|num)|num.*shard/i },
        series:  { names: ["storage_series_total", "storage_series_num", "storage_bucket_series_num"], re: /series_(total|num)|numseries|cardinality/i },
    };

    function parseProm(text) {
        const map = new Map();
        const re = /^([a-zA-Z_:][\w:]*)(?:\{[^}]*\})?[ \t]+([^ \t]+)/;
        for (const raw of text.split("\n")) {
            const line = raw.trim();
            if (!line || line[0] === "#") continue;
            const m = re.exec(line);
            if (!m) continue;
            const v = parseFloat(m[2]);
            if (!isFinite(v)) continue;
            map.set(m[1], (map.get(m[1]) || 0) + v); // sum across label sets
        }
        return map;
    }
    // Flatten expvar JSON into a name→number map so the same picker works on /debug/vars.
    function flatten(obj, prefix, out) {
        out = out || new Map();
        for (const k in obj) {
            const v = obj[k], key = (prefix ? prefix + "_" + k : k).toLowerCase();
            if (v && typeof v === "object") flatten(v, key, out);
            else if (typeof v === "number" && isFinite(v)) out.set(key, (out.get(key) || 0) + v);
        }
        return out;
    }
    function pick(map, cfg) {
        for (const n of cfg.names) if (map.has(n)) return map.get(n);
        let s = 0, f = false;
        for (const [k, v] of map) if (cfg.re.test(k)) { s += v; f = true; }
        return f ? s : null;
    }
    function rate(store, key, value) {
        const now = Date.now(), p = store[key];
        if (value != null) store[key] = { v: value, t: now };
        if (!p || value == null) return null;
        const dt = (now - p.t) / 1000;
        if (dt <= 0) return null;
        const dv = value - p.v;
        return dv < 0 ? 0 : dv / dt; // guard counter resets
    }
    const num = (fmt, n) => (n == null ? "—" : fmt.num(Math.round(n)));
    const dec = n => (Math.round(n * 10) / 10).toLocaleString();
    const row = (k, v) => `<span class="k">${k}</span><span class="v">${v}</span>`;
    function html(ctx) {
        const t = ctx.t;
        return `
            <div class="metric-row"><span class="k">${t("ap.influx.write")}</span><span class="v"><b data-ref="wr">--</b> pts/s</span></div>
            <canvas class="apw-graph" data-ref="g" style="margin-top:8px"></canvas>
            <div class="apw-kv" data-ref="kv" style="margin-top:8px"></div>
            <div class="apw-th">${t("ap.influx.totals")}</div>
            <div class="apw-kv" data-ref="tot"></div>`;
    }

    window.APWidget.define({
        id: "ap-influx",
        title: "ap.influx.title",
        category: "apetrov",
        description: "InfluxDB write/query rates · storage · shards · series cardinality",
        defaultSize: { w: 6, h: 6 },
        interval: 5000,
        ranges: true,
        i18n: {
            en: { "ap.influx.title": "InfluxDB · A.Petrov", "ap.influx.write": "WRITE", "ap.influx.query": "QUERY", "ap.influx.storage": "STORAGE", "ap.influx.shards": "SHARDS", "ap.influx.series": "SERIES", "ap.influx.totals": "TOTALS" },
            ru: { "ap.influx.title": "InfluxDB · A.Petrov", "ap.influx.write": "ЗАПИСЬ", "ap.influx.query": "ЗАПРОСЫ", "ap.influx.storage": "ХРАНИЛИЩЕ", "ap.influx.shards": "ШАРДЫ", "ap.influx.series": "СЕРИИ", "ap.influx.totals": "ВСЕГО" },
        },
        settings: [
            { key: "interval", label: "Refresh interval (ms)", type: "number", default: 5000 },
            { key: "url", label: "InfluxDB URL", type: "text", default: "http://localhost:8086" },
            { key: "token", label: "Auth token (optional)", type: "text", default: "" },
        ],
        render(ctx) { ctx.body.innerHTML = html(ctx); },
        redraw(ctx) { ctx.graph('[data-ref="g"]', "write", { min: 0 }); },
        async update(ctx) {
            const url = String(ctx.settings.url || "").trim().replace(/\/+$/, "");
            if (!url) return ctx.notAvailable("Set the InfluxDB URL in settings");
            const headers = { Accept: "text/plain" };
            if (ctx.settings.token) headers.Authorization = "Token " + ctx.settings.token;

            let map = null, source = "/metrics", ferr = "";
            try {
                const r = await ctx.http(url + "/metrics", { headers, timeout: 8000 });
                if (r && r.ok && r.text && !r.text.trim().startsWith("{")) map = parseProm(r.text);
                else ferr = r ? (r.error || "HTTP " + r.status) : "unreachable";
            } catch (e) { ferr = (e && e.message) || "error"; }

            if (!map || !map.size) { // fall back to expvar
                try {
                    const r2 = await ctx.http(url + "/debug/vars", { headers, timeout: 8000 });
                    if (r2 && r2.ok && r2.text) { map = flatten(JSON.parse(r2.text)); source = "/debug/vars"; }
                    else if (!ferr) ferr = r2 ? (r2.error || "HTTP " + r2.status) : "unreachable";
                } catch (e) { if (!ferr) ferr = (e && e.message) || "error"; }
            }
            if (!map || !map.size) return ctx.notAvailable("InfluxDB metrics unreachable" + (ferr ? ": " + ferr : ""));

            // notAvailable may have wiped the DOM on a previous tick — rebuild if needed.
            if (!ctx.$('[data-ref="g"]')) { ctx.body.innerHTML = html(ctx); ctx.bindRefs(); }

            const fmt = ctx.fmt, store = ctx.__prev || (ctx.__prev = {});
            const wPts = pick(map, M.write), qCnt = pick(map, M.query);
            const wRate = rate(store, "w", wPts), qRate = rate(store, "q", qCnt);
            const storage = pick(map, M.storage), shards = pick(map, M.shards), series = pick(map, M.series);

            ctx.ref.wr.textContent = wRate == null ? "--" : dec(wRate);
            if (wRate != null) ctx.push("write", wRate);
            if (qRate != null) ctx.push("query", qRate);

            ctx.ref.kv.innerHTML = [
                row(ctx.t("ap.influx.query"), qRate == null ? "—" : dec(qRate) + " q/s"),
                row(ctx.t("ap.influx.storage"), storage == null ? "—" : fmt.bytes(storage)),
                row(ctx.t("ap.influx.shards"), num(fmt, shards)),
                row(ctx.t("ap.influx.series"), num(fmt, series)),
            ].join("");
            ctx.ref.tot.innerHTML = [
                row("Points written", num(fmt, wPts)),
                row("Queries", num(fmt, qCnt)),
            ].join("");

            ctx.graph('[data-ref="g"]', "write", { min: 0 });
            ctx.setStatus("via " + source + " · " + new Date().toLocaleTimeString(), "");
        },
    });
})();
