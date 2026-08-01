"use strict";
// A.Petrov-style Docker widget: container list with CPU/RAM/net/disk/status,
// state chips, total-CPU live graph. Degrades when docker is missing/down.

const AP_DOCKER_SKELETON = `
    <div class="metric-row"><span class="k">CONTAINERS</span><span class="v"><b data-ref="run">--</b> / <span data-ref="tot">--</span></span></div>
    <div data-ref="chips" style="margin:2px 0 6px"></div>
    <div class="metric-row"><span class="k">TOTAL CPU</span><span class="v"><b data-ref="cpu">--</b>%<span data-ref="mem" style="color:var(--text-dim);margin-left:8px"></span></span></div>
    <canvas class="apw-graph" data-ref="g"></canvas>
    <div class="apw-th">Containers</div>
    <table><thead><tr>
        <th style="text-align:left">NAME</th><th style="text-align:left">STATUS</th>
        <th style="text-align:right">CPU</th><th style="text-align:right">MEM</th>
        <th style="text-align:right">NET I/O</th><th style="text-align:right">BLK I/O</th>
    </tr></thead><tbody data-ref="rows"></tbody></table>`;

// state → apw-chip modifier
const AP_DOCKER_CHIP = { running: "ok", restarting: "warn", paused: "warn", created: "warn", removing: "warn", exited: "err", dead: "err" };

// docker mem/net strings ("12.5MiB", "1.2kB") → bytes, binary + decimal units
function apDockerBytes(s) {
    const m = String(s || "").trim().match(/([\d.]+)\s*([a-zA-Z]*)/);
    if (!m) return 0;
    const map = { b: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4 };
    return (parseFloat(m[1]) || 0) * (map[(m[2] || "b").toLowerCase()] || 1);
}

// run a `docker ... {{json .}}` command → {rows} or {err}
async function apDockerJson(ctx, args) {
    let res;
    try { res = await ctx.exec("docker", args, { timeout: 12000 }); }
    catch (e) { return { err: "Docker CLI not found" }; }
    if (!res || res.code !== 0) {
        const e = (res && (res.stderr || "")).toLowerCase();
        if (e.includes("cannot connect") || e.includes("daemon")) return { err: "Docker daemon not running" };
        if (e.includes("not found") || (res && res.code === 127)) return { err: "Docker CLI not found" };
        return { err: "Docker not available" };
    }
    const rows = [];
    (res.stdout || "").split("\n").forEach(l => { l = l.trim(); if (l) try { rows.push(JSON.parse(l)); } catch (_) {} });
    return { rows };
}

window.APWidget.define({
    id: "ap-docker",
    title: "ap.docker.title",
    category: "apetrov",
    description: "Docker containers · CPU/RAM/net/disk · state chips · live graph",
    defaultSize: { w: 12, h: 7 },
    interval: 3000,
    ranges: true,
    i18n: { en: { "ap.docker.title": "Docker · A.Petrov" }, ru: { "ap.docker.title": "Docker · A.Petrov" } },
    settings: [
        { key: "interval", label: "Refresh interval (ms)", type: "number", default: 3000 },
        { key: "all", label: "Include stopped containers", type: "checkbox", default: false },
    ],
    render(ctx) { ctx.body.innerHTML = AP_DOCKER_SKELETON; },
    redraw(ctx) { ctx.graph('[data-ref="g"]', "dccpu", { min: 0 }); },
    async update(ctx) {
        const psArgs = ["ps", "--format", "{{json .}}"];
        if (ctx.settings.all) psArgs.splice(1, 0, "-a");
        const ps = await apDockerJson(ctx, psArgs);
        if (ps.err) { ctx.notAvailable(ps.err); return; }
        // rebuild static DOM if a prior notAvailable() wiped it
        if (!ctx.$('[data-ref="rows"]')) { ctx.body.innerHTML = AP_DOCKER_SKELETON; ctx.bindRefs(); }

        // stats may flap independently of ps — treat failure as "no stats yet"
        const stats = await apDockerJson(ctx, ["stats", "--no-stream", "--format", "{{json .}}"]);
        const smap = {};
        (stats.rows || []).forEach(s => { const id = (s.ID || "").slice(0, 12); if (id) smap[id] = s; if (s.Name) smap[s.Name] = s; });

        const counts = {}; let totCpu = 0, totMem = 0;
        const list = (ps.rows || []).slice(0, 200).map(r => {
            const id = (r.ID || "").slice(0, 12);
            const st = smap[id] || smap[r.Names] || {};
            const state = (r.State || "").toLowerCase();
            counts[state] = (counts[state] || 0) + 1;
            const cpu = parseFloat(st.CPUPerc) || 0;
            const memUse = st.MemUsage ? st.MemUsage.split("/")[0].trim() : "";
            if (state === "running") { totCpu += cpu; totMem += apDockerBytes(memUse); }
            return { name: r.Names || id, state, cpu, cpuS: st.CPUPerc || "—", mem: memUse || "—", net: st.NetIO || "—", blk: st.BlockIO || "—" };
        });

        ctx.ref.run.textContent = counts.running || 0;
        ctx.ref.tot.textContent = list.length;
        ctx.ref.cpu.textContent = totCpu.toFixed(totCpu < 10 ? 1 : 0);
        ctx.ref.mem.textContent = totMem ? "· RAM " + ctx.fmt.bytes(totMem) : "";
        ctx.ref.chips.innerHTML = Object.keys(counts).sort()
            .map(k => `<span class="apw-chip ${AP_DOCKER_CHIP[k] || ""}" style="margin-right:4px">${counts[k]} ${ctx.fmt.esc(k || "?")}</span>`).join("");

        ctx.push("dccpu", totCpu);
        ctx.graph('[data-ref="g"]', "dccpu", { min: 0 });

        if (!list.length) {
            ctx.ref.rows.innerHTML = `<tr><td colspan="6" style="color:var(--text-dim);padding:8px">${ctx.settings.all ? "no containers" : "no running containers"}</td></tr>`;
            ctx.setStatus(""); return;
        }
        ctx.ref.rows.innerHTML = list.map(c => {
            const cls = AP_DOCKER_CHIP[c.state] || "";
            const col = c.cpu > 80 ? "var(--danger)" : "var(--accent)";
            return `<tr>
                <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ctx.fmt.esc(c.name)}</td>
                <td><span class="apw-chip ${cls}">${ctx.fmt.esc(c.state || "?")}</span></td>
                <td style="text-align:right;color:${col};font-variant-numeric:tabular-nums">${ctx.fmt.esc(c.cpuS)}</td>
                <td style="text-align:right;color:var(--text-dim)">${ctx.fmt.esc(c.mem)}</td>
                <td style="text-align:right;color:var(--text-dim)">${ctx.fmt.esc(c.net)}</td>
                <td style="text-align:right;color:var(--text-dim)">${ctx.fmt.esc(c.blk)}</td></tr>`;
        }).join("");
        ctx.setStatus(`${list.length} container${list.length !== 1 ? "s" : ""} · ${new Date().toLocaleTimeString()}`, "");
    },
});
