"use strict";
// A.Petrov-style System widget: uptime, load avg, process/user counts, OS facts.
window.APWidget.define({
    id: "ap-system",
    title: "ap.system.title",
    category: "apetrov",
    description: "Uptime · load average · processes · users · OS / kernel",
    defaultSize: { w: 6, h: 5 },
    interval: 5000,
    ranges: false,
    i18n: { en: { "ap.system.title": "System · A.Petrov" }, ru: { "ap.system.title": "System · A.Petrov" } },
    settings: [
        { key: "interval", label: "Refresh interval (ms)", type: "number", default: 5000 },
    ],
    render(ctx) {
        ctx.body.innerHTML = `
            <div class="metric-row"><span class="k">UPTIME</span><span class="v"><b data-ref="uptime">--</b></span></div>
            <div class="metric-row"><span class="k">LOAD AVG</span><span class="v"><b data-ref="load">--</b></span></div>
            <div class="metric-row"><span class="k">PROCESSES</span><span class="v"><b data-ref="procs">--</b></span></div>
            <div class="metric-row"><span class="k">USERS</span><span class="v"><b data-ref="users">--</b></span></div>
            <div class="apw-th">HOST</div>
            <div class="apw-kv">
                <div class="kvp"><span class="k">host</span><span class="v" data-ref="host">--</span></div>
                <div class="kvp"><span class="k">distro</span><span class="v" data-ref="distro">--</span></div>
                <div class="kvp"><span class="k">release</span><span class="v" data-ref="release">--</span></div>
                <div class="kvp"><span class="k">kernel</span><span class="v" data-ref="kernel">--</span></div>
                <div class="kvp"><span class="k">platform</span><span class="v" data-ref="platform">--</span></div>
                <div class="kvp"><span class="k">arch</span><span class="v" data-ref="arch">--</span></div>
            </div>`;
    },
    async update(ctx) {
        // Remote → read the ssh'd server's /proc + uname + os-release.
        if (ctx.remote) {
            const d = await window.APRemote.system(ctx);
            if (!d || d.error) return ctx.setStatus((ctx.host && ctx.host.label ? ctx.host.label + ": " : "") + ((d && d.error) || "no data"), "err");
            const g = v => ctx.fmt.esc(v || "n/a");
            ctx.ref.uptime.textContent = d.uptime ? ctx.fmt.duration(d.uptime) : "n/a";
            ctx.ref.load.textContent = d.load.map(x => x.toFixed(2)).join("  ");
            ctx.ref.procs.textContent = d.procs ? ctx.fmt.num(d.procs) : "n/a";
            ctx.ref.users.textContent = d.users != null ? String(d.users) : "0";
            ctx.ref.host.textContent = g(d.hostname);
            ctx.ref.distro.textContent = g(d.os);
            ctx.ref.release.textContent = g(d.os);
            ctx.ref.kernel.textContent = g(d.kernel);
            ctx.ref.platform.textContent = "linux";
            ctx.ref.arch.textContent = g(d.arch);
            ctx.setStatus("● " + (ctx.host && ctx.host.label ? ctx.host.label : ""));
            return;
        }
        // Fetch every source independently so one missing metric never blanks the rest.
        const [time, load, procs, users, os] = await Promise.all([
            ctx.si("time").catch(() => null),
            ctx.si("currentLoad").catch(() => null),
            ctx.si("processes").catch(() => null),
            ctx.si("users").catch(() => null),
            ctx.si("osInfo").catch(() => null),
        ]);

        // uptime
        ctx.ref.uptime.textContent = (time && typeof time.uptime === "number")
            ? ctx.fmt.duration(time.uptime) : "n/a";

        // load average (single value from currentLoad.avgLoad; 0/absent on some hosts)
        const avg = load && Number(load.avgLoad);
        ctx.ref.load.textContent = (avg && isFinite(avg) && avg > 0) ? avg.toFixed(2) : "n/a";

        // process count — prefer the reported total, fall back to list length
        let pc = "n/a";
        if (procs) {
            if (procs.all != null) pc = ctx.fmt.num(procs.all);
            else if (Array.isArray(procs.list)) pc = ctx.fmt.num(procs.list.length);
        }
        ctx.ref.procs.textContent = pc;

        // user count (si("users") → array of sessions)
        const list = Array.isArray(users) ? users : [];
        const uniq = new Set(list.map(u => u && u.user).filter(Boolean));
        ctx.ref.users.textContent = list.length
            ? `${uniq.size} (${list.length} session${list.length === 1 ? "" : "s"})`
            : "0";

        // OS facts (mostly static)
        const g = (v) => ctx.fmt.esc(v || "n/a");
        ctx.ref.host.textContent = g(os && os.hostname);
        ctx.ref.distro.textContent = g(os && os.distro);
        ctx.ref.release.textContent = g(os && os.release);
        ctx.ref.kernel.textContent = g(os && os.kernel);
        ctx.ref.platform.textContent = g(os && os.platform);
        ctx.ref.arch.textContent = g(os && os.arch);

        if (!time && !load && !procs && !os) {
            ctx.setStatus("system stats unavailable", "err");
        } else {
            ctx.setStatus("");
        }
    },
});
