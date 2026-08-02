"use strict";
// System widget — commissioned by A. Petrov. Uptime, load avg, process/user counts, OS facts.
window.APWidget.define({
    id: "ap-system",
    title: "ap.system.title",
    category: "apetrov",
    description: "Uptime · load average · processes · users · OS / kernel",
    defaultSize: { w: 6, h: 5 },
    interval: 5000,
    ranges: false,
    i18n: { en: { "ap.system.title": "System Overview" }, ru: { "ap.system.title": "Система" } },
    settings: [
        { key: "interval", label: "Refresh interval (ms)", type: "number", default: 5000 },
    ],
    render(ctx) {
        ctx.body.innerHTML = `
            <div class="metric-row"><span class="k">UPTIME</span><span class="v"><b data-ref="uptime">--</b></span></div>
            <div class="metric-row"><span class="k">LOAD AVG</span><span class="v"><b data-ref="load">--</b></span></div>
            <div class="metric-row"><span class="k">PROCESSES</span><span class="v"><b data-ref="procs">--</b></span></div>
            <div class="metric-row"><span class="k">USERS</span><span class="v"><b data-ref="users">--</b></span></div>
            <div class="apw-th" data-ref="hostHdr">HOST<span class="apw-egg-dot" data-ref="eggDot" title="">◈</span></div>
            <div class="apw-kv">
                <div class="kvp"><span class="k">host</span><span class="v" data-ref="host">--</span></div>
                <div class="kvp"><span class="k">distro</span><span class="v" data-ref="distro">--</span></div>
                <div class="kvp"><span class="k">release</span><span class="v" data-ref="release">--</span></div>
                <div class="kvp"><span class="k">kernel</span><span class="v" data-ref="kernel">--</span></div>
                <div class="kvp"><span class="k">platform</span><span class="v" data-ref="platform">--</span></div>
                <div class="kvp"><span class="k">arch</span><span class="v" data-ref="arch">--</span></div>
            </div>
            <!-- Hidden credit: tap the HOST header seven times. Commissioned by A. Petrov. -->
            <div class="apw-egg" data-ref="egg" aria-hidden="true">
                <span class="scan"></span>
                <div class="frame">◈ ────────── ◈</div>
                <div class="sig">A·PETROV</div>
                <div class="frame">◈ ────────── ◈</div>
                <div class="cap">monitoring suite — commissioned by A.&nbsp;Petrov</div>
            </div>`;

        // ── Easter egg: seven taps on the HOST header reveal the commission credit.
        //    The ◈ next to HOST is the tell — it warms up from the 4th tap on.
        if (!document.getElementById("apw-egg-css")) {
            const s = document.createElement("style");
            s.id = "apw-egg-css";
            s.textContent = `
                .apw-egg-dot{opacity:.16;margin-left:7px;font-size:.85em;cursor:pointer;user-select:none;transition:opacity .25s,color .25s,text-shadow .25s}
                .apw-th:hover .apw-egg-dot{opacity:.4}
                .apw-egg-dot.warm{opacity:.95;color:var(--accent,#4fd1ff);text-shadow:0 0 8px var(--accent,#4fd1ff)}
                .apw-egg{display:none;margin-top:10px;padding:12px 10px;text-align:center;position:relative;overflow:hidden;border:1px solid var(--accent,#4fd1ff);border-radius:8px;background:linear-gradient(180deg,rgba(79,209,255,.07),rgba(79,209,255,.01))}
                .apw-egg.show{display:block;animation:apw-egg-in .5s ease both}
                .apw-egg .frame{color:var(--accent,#4fd1ff);opacity:.6;font-size:.8em;letter-spacing:.25em}
                .apw-egg .sig{margin:4px 0;font-size:1.5em;font-weight:700;letter-spacing:.4em;padding-left:.4em;color:var(--accent,#4fd1ff);text-shadow:0 0 12px var(--accent,#4fd1ff)}
                .apw-egg .cap{margin-top:6px;font-size:.76em;letter-spacing:.1em;color:var(--text-dim,#8aa)}
                .apw-egg .scan{position:absolute;left:0;right:0;top:0;height:2px;background:rgba(79,209,255,.55);filter:blur(1px);pointer-events:none;animation:apw-egg-scan 2.4s linear infinite}
                @keyframes apw-egg-in{from{opacity:0;transform:translateY(6px) scale(.985)}to{opacity:1;transform:none}}
                @keyframes apw-egg-scan{from{top:-2px}to{top:100%}}`;
            document.head.appendChild(s);
        }
        const hdr = ctx.body.querySelector('[data-ref="hostHdr"]');
        const dot = ctx.body.querySelector('[data-ref="eggDot"]');
        const egg = ctx.body.querySelector('[data-ref="egg"]');
        if (hdr && egg) {
            let taps = 0, resetT = null, hideT = null;
            hdr.addEventListener("click", () => {
                taps++;
                clearTimeout(resetT);
                resetT = setTimeout(() => { taps = 0; if (dot) dot.classList.remove("warm"); }, 2000);
                if (dot) dot.classList.toggle("warm", taps >= 4 && taps < 7);
                if (taps >= 7) {
                    taps = 0; clearTimeout(resetT);
                    if (dot) dot.classList.remove("warm");
                    egg.classList.add("show");
                    clearTimeout(hideT);
                    hideT = setTimeout(() => egg.classList.remove("show"), 7000);
                }
            });
        }
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
