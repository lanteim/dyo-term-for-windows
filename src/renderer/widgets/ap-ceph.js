"use strict";
// A.Petrov-style Ceph widget: cluster health · usage · OSD/MON/MDS/PG · recovery.
// Backed by `ceph -s -f json`; degrades gracefully where the ceph CLI is absent.
(function () {
    const kv = (k, v, kind) => {
        const c = kind === "err" ? "var(--danger)" : kind === "warn" ? "#fbbf24" : "var(--text)";
        return `<span class="k">${k}</span><span class="v" style="color:${c}">${v}</span>`;
    };
    const ratio = (fmt, objs, total, r) => {
        const p = r != null ? (Number(r) * 100) : 0;
        return `${fmt.num(objs || 0)}${total ? " / " + fmt.num(total) : ""}${r ? ` (${p.toFixed(2)}%)` : ""}`;
    };
    const pgColor = name => {
        if (/(degraded|down|stale|incomplete|inconsistent|undersized|unknown)/.test(name)) return "var(--danger)";
        if (!/clean/.test(name) || /(recover|backfill|remapped|peering)/.test(name)) return "#fbbf24";
        return "var(--accent2)";
    };

    window.APWidget.define({
        id: "ap-ceph",
        title: "ap.ceph.title",
        category: "apetrov",
        description: "Ceph cluster health · usage · OSD/MON/MDS/PG · recovery",
        defaultSize: { w: 6, h: 6 },
        interval: 5000,
        ranges: true,
        i18n: {
            en: {
                "ap.ceph.title": "Ceph · A.Petrov",
                "ap.ceph.health": "HEALTH", "ap.ceph.usage": "USAGE",
                "ap.ceph.states": "PG STATES", "ap.ceph.recovery": "RECOVERY",
            },
            ru: {
                "ap.ceph.title": "Ceph · A.Petrov",
                "ap.ceph.health": "ЗДОРОВЬЕ", "ap.ceph.usage": "ИСПОЛЬЗОВАНИЕ",
                "ap.ceph.states": "СОСТОЯНИЯ PG", "ap.ceph.recovery": "ВОССТАНОВЛЕНИЕ",
            },
        },
        settings: [
            { key: "interval", label: "Refresh interval (ms)", type: "number", default: 5000 },
        ],
        render(ctx) {
            ctx.body.innerHTML = `
                <div class="metric-row"><span class="k">${ctx.t("ap.ceph.health")}</span><span class="v"><span class="apw-chip" data-ref="health">—</span></span></div>
                <div data-ref="checks" style="color:var(--text-dim);font-size:11px;margin-bottom:8px;line-height:1.4"></div>
                <div class="metric-row"><span class="k">${ctx.t("ap.ceph.usage")}</span><span class="v"><b data-ref="usepct">--</b>%<span data-ref="usebytes" style="color:var(--text-dim);margin-left:8px"></span></span></div>
                <div class="bar"><i data-ref="usebar"></i></div>
                <canvas class="apw-graph" data-ref="g" style="margin-top:8px"></canvas>
                <div class="apw-kv" data-ref="kv" style="margin-top:8px"></div>
                <div class="apw-th">${ctx.t("ap.ceph.states")}</div>
                <div class="apw-cores" data-ref="pgs"></div>
                <div class="apw-th">${ctx.t("ap.ceph.recovery")}</div>
                <div class="apw-kv" data-ref="rec"></div>`;
        },
        redraw(ctx) { ctx.graph('[data-ref="g"]', "usage", { min: 0, max: 100 }); },
        async update(ctx) {
            let res;
            try { res = await ctx.exec("ceph", ["-s", "-f", "json"], { timeout: 8000 }); }
            catch (e) { res = null; }
            if (!res || res.code !== 0 || !res.stdout || !res.stdout.trim()) {
                const err = ((res && res.stderr) || "").toLowerCase();
                if (!res || res.code === 127 || err.includes("not found") || err.includes("command not"))
                    return ctx.notAvailable("ceph CLI not found on this host");
                return ctx.notAvailable("ceph -s failed" + ((res && res.stderr) ? ": " + res.stderr.trim().split("\n")[0] : ""));
            }
            let j;
            try { j = JSON.parse(res.stdout); } catch (e) { return ctx.notAvailable("could not parse ceph JSON output"); }
            const fmt = ctx.fmt;

            // ── health chip + check summaries ──
            const status = (j.health && j.health.status) || "UNKNOWN";
            const kind = status === "HEALTH_OK" ? "ok" : status === "HEALTH_ERR" ? "err" : status === "HEALTH_WARN" ? "warn" : "";
            ctx.ref.health.textContent = status;
            ctx.ref.health.className = "apw-chip" + (kind ? " " + kind : "");
            const checks = (j.health && j.health.checks) || {};
            const cs = Object.keys(checks).map(k => (checks[k].summary && checks[k].summary.message) || k);
            ctx.ref.checks.textContent = cs.slice(0, 5).join(" · ");

            // ── usage ──
            const pg = j.pgmap || {};
            const used = Number(pg.bytes_used) || 0, total = Number(pg.bytes_total) || 0;
            const pct = total > 0 ? (used / total) * 100 : 0;
            ctx.ref.usepct.textContent = pct.toFixed(1);
            ctx.ref.usebar.style.width = Math.min(100, pct) + "%";
            ctx.ref.usebytes.textContent = fmt.bytes(used) + " / " + fmt.bytes(total);
            ctx.push("usage", Math.round(pct * 10) / 10);

            // ── OSD / MON / MDS / PG ──
            const om = (j.osdmap && (j.osdmap.osdmap || j.osdmap)) || {};
            const mon = j.monmap || {};
            const numMon = mon.num_mons != null ? mon.num_mons : (mon.mons ? mon.mons.length : (j.quorum_names ? j.quorum_names.length : "—"));
            const fs = j.fsmap || {};
            const up = om.num_up_osds, inn = om.num_in_osds, all = om.num_osds;
            const osdBad = (Number(all) || 0) > (Number(up) || 0);
            ctx.ref.kv.innerHTML = [
                kv("OSDs", `${up == null ? "—" : up} up · ${inn == null ? "—" : inn} in · ${all == null ? "—" : all} total`, osdBad ? "warn" : ""),
                kv("MONs", `${numMon}${j.quorum ? " · quorum " + j.quorum.length : ""}`),
                kv("MDS", `${fs.up == null ? 0 : fs.up} up · ${fs.in == null ? 0 : fs.in} in · ${fs["up:standby"] || 0} standby`),
                kv("PGs", `${pg.num_pgs == null ? "—" : fmt.num(pg.num_pgs)}${pg.num_pools != null ? " · " + pg.num_pools + " pools" : ""}${pg.num_objects != null ? " · " + fmt.num(pg.num_objects) + " objs" : ""}`),
            ].join("");

            // ── PG states ──
            const states = pg.pgs_by_state || [];
            ctx.ref.pgs.innerHTML = states.length
                ? states.map(s => `<div class="apw-core" title="${fmt.esc(s.state_name)}">${fmt.esc(s.state_name.replace(/\+/g, "+​"))}<div style="font-size:11px;color:${pgColor(s.state_name)}">${fmt.num(s.count)}</div></div>`).join("")
                : `<span style="color:var(--text-dim);font-size:11px">—</span>`;

            // ── recovery / client I/O ──
            ctx.ref.rec.innerHTML = [
                kv("Recovering", fmt.bps(pg.recovering_bytes_per_sec || 0) + " · " + fmt.num(pg.recovering_objects_per_sec || 0) + " obj/s"),
                kv("Degraded", ratio(fmt, pg.degraded_objects, pg.degraded_total, pg.degraded_ratio), pg.degraded_ratio > 0 ? "warn" : ""),
                kv("Misplaced", ratio(fmt, pg.misplaced_objects, pg.misplaced_total, pg.misplaced_ratio), pg.misplaced_ratio > 0 ? "warn" : ""),
                kv("Client I/O", fmt.bps(pg.read_bytes_sec || 0) + " rd · " + fmt.bps(pg.write_bytes_sec || 0) + " wr"),
            ].join("");

            ctx.graph('[data-ref="g"]', "usage", { min: 0, max: 100 });
            ctx.setStatus(status === "HEALTH_OK" || !cs.length ? "" : cs.length + " check(s)", kind);
        },
    });
})();
