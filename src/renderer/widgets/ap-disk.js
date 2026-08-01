"use strict";
// A.Petrov-style Disk widget: throughput · IOPS · live total-IO graph · FS usage + inodes.
window.APWidget.define({
    id: "ap-disk",
    title: "ap.disk.title",
    category: "apetrov",
    description: "Disk throughput · IOPS · live graph · filesystem usage + inodes",
    defaultSize: { w: 6, h: 6 },
    interval: 2000,
    ranges: true,
    i18n: {
        en: {
            "ap.disk.title": "Disk · A.Petrov", "ap.disk.total": "TOTAL I/O", "ap.disk.read": "Read",
            "ap.disk.write": "Write", "ap.disk.lat": "Latency", "ap.disk.fs": "Filesystems",
        },
        ru: {
            "ap.disk.title": "Диск · A.Petrov", "ap.disk.total": "ВСЕГО I/O", "ap.disk.read": "Чтение",
            "ap.disk.write": "Запись", "ap.disk.lat": "Задержка", "ap.disk.fs": "Файловые системы",
        },
    },
    settings: [
        { key: "interval", label: "Refresh interval (ms)", type: "number", default: 2000 },
        { key: "maxFs", label: "Max filesystems", type: "number", default: 8 },
    ],
    render(ctx) {
        const t = ctx.t;
        ctx.body.innerHTML = `
            <div class="metric-row"><span class="k">${t("ap.disk.total")}</span>
                <span class="v"><b data-ref="tot">--</b> IOPS<span data-ref="rw" style="color:var(--text-dim);margin-left:8px"></span></span></div>
            <canvas class="apw-graph" data-ref="g" style="margin-top:6px"></canvas>
            <div class="apw-kv" style="margin-top:8px">
                <span class="k">${t("ap.disk.read")}</span><span class="v"><b data-ref="rb">--</b> · <span data-ref="ri">--</span> IOPS</span>
                <span class="k">${t("ap.disk.write")}</span><span class="v"><b data-ref="wb">--</b> · <span data-ref="wi">--</span> IOPS</span>
                <span class="k">${t("ap.disk.lat")}</span><span class="v" data-ref="lat">--</span>
            </div>
            <div class="apw-th">${t("ap.disk.fs")}</div>
            <table><tbody data-ref="fs"></tbody></table>`;
    },
    redraw(ctx) { ctx.graph('[data-ref="g"]', "io", { min: 0 }); },
    async update(ctx) {
        const fmt = ctx.fmt;
        // Remote → read the ssh'd server's df + /proc/diskstats.
        if (ctx.remote) {
            const d = await window.APRemote.disk(ctx);
            if (!d) return ctx.setStatus("no disk data from " + (ctx.host && ctx.host.label), "err");
            ctx.ref.rb.textContent = fmt.bps(d.readSec);
            ctx.ref.wb.textContent = fmt.bps(d.writeSec);
            ctx.ref.ri.textContent = "—"; ctx.ref.wi.textContent = "—";
            ctx.ref.tot.textContent = Math.round(d.iops);
            ctx.ref.rw.textContent = `R ${fmt.bps(d.readSec)} · W ${fmt.bps(d.writeSec)}`;
            ctx.ref.lat.textContent = "n/a";
            ctx.push("io", d.iops);
            ctx.graph('[data-ref="g"]', "io", { min: 0 });
            const list = (d.fs || []).filter(v => v.size > 0)
                .sort((a, b) => { const am = a.mount === "/" ? 1 : 0, bm = b.mount === "/" ? 1 : 0; return am !== bm ? bm - am : b.size - a.size; })
                .slice(0, Math.max(1, Number(ctx.settings.maxFs) || 8));
            ctx.ref.fs.innerHTML = list.map(v => {
                const pct = Math.round(v.usePct || 0);
                const col = pct >= 90 ? "var(--danger)" : pct >= 75 ? "var(--accent2)" : "var(--accent)";
                const inoTxt = v.inodePct != null ? v.inodePct + "% i" : "—";
                return `<tr><td title="${fmt.esc(v.mount)}" style="max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${fmt.esc(v.mount)}</td>`
                    + `<td style="width:30%"><div class="bar"><i style="width:${pct}%;background:${col}"></i></div></td>`
                    + `<td style="text-align:right;color:var(--text-dim)">${fmt.bytes(v.used)}/${fmt.bytes(v.size)}</td>`
                    + `<td style="text-align:right"><b style="color:var(--accent)">${fmt.bytes(Math.max(0, v.size - v.used))}</b> free</td>`
                    + `<td style="text-align:right;color:var(--text-dim)">${inoTxt}</td></tr>`;
            }).join("");
            ctx.setStatus("● " + ctx.host.label);
            return;
        }
        const [fsSize, fsStats, io] = await Promise.all([
            ctx.si("fsSize").catch(() => null),
            ctx.si("fsStats").catch(() => null),
            ctx.si("disksIO").catch(() => null),
        ]);
        const vols = Array.isArray(fsSize) ? fsSize : [];
        if (!vols.length && !fsStats && !io) return ctx.notAvailable("Disk metrics not available on this host");

        // ── throughput (bytes/s) + IOPS (ops/s) ──
        const rB = fsStats && fsStats.rx_sec != null ? Math.max(0, fsStats.rx_sec) : null;
        const wB = fsStats && fsStats.wx_sec != null ? Math.max(0, fsStats.wx_sec) : null;
        const rIo = io && io.rIO_sec != null ? Math.max(0, io.rIO_sec) : null;
        const wIo = io && io.wIO_sec != null ? Math.max(0, io.wIO_sec) : null;
        let tIo = io && io.tIO_sec != null ? Math.max(0, io.tIO_sec)
            : (rIo != null || wIo != null ? (rIo || 0) + (wIo || 0) : null);

        ctx.ref.rb.textContent = rB == null ? "n/a" : fmt.bps(rB);
        ctx.ref.wb.textContent = wB == null ? "n/a" : fmt.bps(wB);
        ctx.ref.ri.textContent = rIo == null ? "—" : Math.round(rIo);
        ctx.ref.wi.textContent = wIo == null ? "—" : Math.round(wIo);
        ctx.ref.tot.textContent = tIo == null ? "n/a" : Math.round(tIo);
        ctx.ref.rw.textContent = (rB != null || wB != null) ? `R ${fmt.bps(rB || 0)} · W ${fmt.bps(wB || 0)}` : "";

        // latency: prefer busy%, else per-op wait times, else combined ms
        let lat = "n/a";
        if (io) {
            if (io.tWaitPercent != null && isFinite(io.tWaitPercent)) lat = fmt.pct(io.tWaitPercent) + " busy";
            else if (io.rWaitTime != null || io.wWaitTime != null) lat = `r ${Math.round(io.rWaitTime || 0)}ms · w ${Math.round(io.wWaitTime || 0)}ms`;
            else if (io.ms != null && isFinite(io.ms)) lat = Math.round(io.ms) + " ms";
        }
        ctx.ref.lat.textContent = lat;

        // ── graph the total IO per second ──
        if (tIo != null) ctx.push("io", tIo);
        ctx.graph('[data-ref="g"]', "io", { min: 0 });

        // ── filesystem usage + free + best-effort inode usage ──
        const inodes = await inodeMap(ctx);
        let list = vols.filter(v => v && typeof v.size === "number" && v.size > 0 &&
            !/^(devfs|autofs|map |tmpfs|overlay|squashfs|none)/i.test(v.fs || ""));
        list.sort((a, b) => {
            const am = (a.mount === "/" || a.mount === "/System/Volumes/Data") ? 1 : 0;
            const bm = (b.mount === "/" || b.mount === "/System/Volumes/Data") ? 1 : 0;
            return am !== bm ? bm - am : (b.size || 0) - (a.size || 0);
        });
        list = list.slice(0, Math.max(1, Number(ctx.settings.maxFs) || 8));

        ctx.ref.fs.innerHTML = list.map(v => {
            const size = v.size || 0;
            const used = typeof v.used === "number" ? v.used : (size - (v.available || 0));
            const pct = typeof v.use === "number" ? Math.round(v.use) : (size > 0 ? Math.round(used / size * 100) : 0);
            const col = pct >= 90 ? "var(--danger)" : pct >= 75 ? "var(--accent2)" : "var(--accent)";
            const label = v.mount || v.fs || "—";
            const ino = inodes[v.mount];
            const inoTxt = ino != null ? ino + "% i" : "—";
            return `<tr>
                <td title="${fmt.esc(label)}" style="max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${fmt.esc(label)}</td>
                <td style="width:30%"><div class="bar"><i style="width:${pct}%;background:${col}"></i></div></td>
                <td style="text-align:right;color:var(--text-dim)">${fmt.bytes(used)}/${fmt.bytes(size)}</td>
                <td style="text-align:right"><b style="color:var(--accent)">${fmt.bytes(Math.max(0, size - used))}</b> free</td>
                <td style="text-align:right;color:var(--text-dim)" title="inode usage">${inoTxt}</td></tr>`;
        }).join("");
        ctx.setStatus("");
    },
});

// Parse `df -i` into { mount: inodeUsePercent }. Degrades to {} on any failure
// (e.g. Windows has no df). Works with macOS (%iused) and Linux (IUse%) headers.
async function inodeMap(ctx) {
    try {
        const r = await ctx.exec("df", ["-i"], { timeout: 6000 });
        if (!r || r.code !== 0 || !r.stdout) return {};
        const lines = r.stdout.split("\n").filter(l => l.trim());
        if (lines.length < 2) return {};
        const head = lines[0].split(/\s+/);
        const idx = head.findIndex(h => /%/.test(h) && /i/i.test(h)); // inode-use% column
        const map = {};
        for (let i = 1; i < lines.length; i++) {
            const c = lines[i].split(/\s+/);
            if (c.length < 3) continue; // skip wrapped device-name rows
            const mount = c[c.length - 1];
            let pct = null;
            if (idx >= 0 && c[idx] != null) { const m = String(c[idx]).match(/(\d+)%/); if (m) pct = +m[1]; }
            map[mount] = pct;
        }
        return map;
    } catch (e) { return {}; }
}
