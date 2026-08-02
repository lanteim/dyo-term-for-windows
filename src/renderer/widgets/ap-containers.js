"use strict";
// Containers widget — commissioned by A. Petrov. Docker (fallback podman) stats — per-container
// CPU/MEM/NET/BLK, status chips from `ps -a`, running/total counters and a live
// graph of total container CPU. Follows the active tab's ssh host via ctx.exec.
window.APWidget.define({
    id: "ap-containers",
    title: "ap.containers.title",
    category: "apetrov",
    description: "Containers · CPU/MEM/NET/BLK · status chips · total-CPU graph (docker/podman)",
    defaultSize: { w: 6, h: 6 },
    interval: 5000,
    ranges: true,
    i18n: {
        en: { "ap.containers.title": "Containers" },
        ru: { "ap.containers.title": "Контейнеры" },
    },
    settings: [
        { key: "interval", label: "Refresh interval (ms)", type: "number", default: 5000 },
        { key: "filter", label: "Filter by name", type: "text", default: "" },
    ],
    render(ctx) {
        ctx.body.innerHTML = `
            <div class="metric-row">
                <span class="k">CONTAINERS</span>
                <span class="v">
                    <span class="apw-chip ok" data-ref="cRun">running 0</span>
                    <span class="apw-chip" data-ref="cTot">total 0</span>
                    <span class="apw-chip" data-ref="cEng">--</span>
                </span>
            </div>
            <div class="metric-row"><span class="k">TOTAL CPU</span><span class="v"><b data-ref="tcpu">--</b>%</span></div>
            <canvas class="apw-graph" data-ref="g" style="margin-top:8px"></canvas>
            <div class="apw-th">CONTAINERS</div>
            <table><thead><tr>
                <th style="text-align:left">NAME</th>
                <th style="text-align:right">CPU%</th>
                <th style="text-align:left">MEM</th>
                <th style="text-align:left">NET</th>
                <th style="text-align:left">STATUS</th>
            </tr></thead><tbody data-ref="rows"></tbody></table>`;
    },
    redraw(ctx) { ctx.graph('[data-ref="g"]', "ccpu", { min: 0 }); },
    async update(ctx) {
        const esc = ctx.fmt.esc;

        // exec that never throws — a spawn failure (local ENOENT) becomes code 127
        const run = async (bin, args) => {
            try { return await ctx.exec(bin, args, { timeout: 15000 }); }
            catch (e) { return { code: 127, stdout: "", stderr: String((e && e.message) || e) }; }
        };
        // "the binary itself is missing" (as opposed to daemon/permission errors)
        const missing = r => {
            if (!r) return true;
            if (r.code === 0) return false;
            const err = String(r.stderr || "").toLowerCase();
            return r.code === 127 || err.includes("enoent") || err.includes("not found") || err.includes("not recognized");
        };
        const lastLine = r => String((r && r.stderr) || "").split("\n").map(s => s.trim()).filter(Boolean).pop() || "";

        // ── engine pick: docker → podman; degrade gracefully if neither works ──
        const STATS = ["stats", "--no-stream", "--format", "{{json .}}"];
        let eng = "docker";
        let stats = await run("docker", STATS);
        if (!stats || stats.code !== 0) {
            const alt = await run("podman", STATS);
            if (alt && alt.code === 0) { eng = "podman"; stats = alt; }
            else {
                // prefer the error of the engine that actually exists on the host
                const best = !missing(stats) ? stats : (!missing(alt) ? alt : null);
                let why;
                if (!best) why = "docker/podman not found";
                else {
                    const raw = lastLine(best);
                    const low = raw.toLowerCase();
                    why = (low.includes("cannot connect") || low.includes("daemon") || low.includes("permission denied"))
                        ? (raw || "container daemon not running")
                        : (raw || (best === stats ? "docker" : "podman") + " stats failed");
                }
                if (ctx.remote) return ctx.setStatus((ctx.host.label || "remote") + ": " + why, "err");
                return ctx.notAvailable(why);
            }
        }

        // ── parse `stats` JSON lines (docker & podman field-name tolerant) ──
        const pctNum = s => { const m = String(s == null ? "" : s).match(/[\d.]+/); return m ? parseFloat(m[0]) : 0; };
        const running = String(stats.stdout || "").split("\n").map(l => l.trim()).filter(Boolean).map(l => {
            let j; try { j = JSON.parse(l); } catch (e) { return null; }
            if (!j || typeof j !== "object") return null;
            const name = Array.isArray(j.Names) ? j.Names[0]
                : String(j.Name || j.Names || j.name || j.ID || j.id || "?").split(",")[0].trim();
            return {
                name,
                cpu: pctNum(j.CPUPerc != null ? j.CPUPerc : (j.CPU != null ? j.CPU : j.cpu_percent)),
                mem: String(j.MemUsage || j.mem_usage || j.MemPerc || "—"),
                net: String(j.NetIO || j.net_io || "—"),
                block: String(j.BlockIO || j.block_io || "—"),
            };
        }).filter(Boolean);

        // ── `ps -a` for status/state chips + stopped containers (best effort) ──
        let psRows = [];
        const ps = await run(eng, ["ps", "-a", "--format", "{{json .}}"]);
        if (ps && ps.code === 0) {
            psRows = String(ps.stdout || "").split("\n").map(l => l.trim()).filter(Boolean).map(l => {
                let j; try { j = JSON.parse(l); } catch (e) { return null; }
                if (!j || typeof j !== "object") return null;
                const name = Array.isArray(j.Names) ? j.Names[0]
                    : String(j.Names || j.Name || j.name || "").split(",")[0].trim();
                return {
                    name,
                    state: String(j.State || j.state || "").toLowerCase(),
                    status: String(j.Status || j.status || ""),
                };
            }).filter(r => r && r.name);
        }
        const byName = new Map(psRows.map(r => [r.name, r]));

        // merged row list: running (with live stats) first, then stopped from ps
        const seen = new Set(running.map(r => r.name));
        let rows = running.map(r => Object.assign({}, r, byName.get(r.name) || { state: "running", status: "" }))
            .concat(psRows.filter(r => !seen.has(r.name)).map(r => ({ name: r.name, cpu: null, mem: "—", net: "—", block: "—", state: r.state, status: r.status })));

        const f = String(ctx.settings.filter || "").trim().toLowerCase();
        if (f) rows = rows.filter(r => r.name.toLowerCase().includes(f));

        // ── counters + total CPU series ──
        const runN = psRows.length ? psRows.filter(r => r.state === "running" || /^up\b/i.test(r.status)).length : running.length;
        const totN = psRows.length || running.length;
        const tcpu = running.reduce((s, r) => s + (r.cpu || 0), 0);
        ctx.ref.cRun.textContent = "running " + runN;
        ctx.ref.cTot.textContent = "total " + totN;
        ctx.ref.cEng.textContent = eng;
        ctx.ref.tcpu.textContent = tcpu.toFixed(1);
        ctx.push("ccpu", tcpu);

        // ── the table ──
        const chip = r => {
            const st = r.state || (/^up\b/i.test(r.status) ? "running" : "");
            const cls = st === "running" ? "ok" : (st === "paused" || st === "restarting" || st === "created" ? "warn" : (st === "exited" || st === "dead" ? "err" : ""));
            return `<span class="apw-chip ${cls}" title="${esc(r.status || "")}">${esc(st || r.status || "—")}</span>`;
        };
        if (!rows.length) {
            ctx.ref.rows.innerHTML = `<tr><td colspan="5" style="color:var(--text-dim);padding:6px">${f ? "no containers match \"" + esc(f) + "\"" : "no containers"}</td></tr>`;
        } else {
            ctx.ref.rows.innerHTML = rows.slice(0, 200).map(r => `<tr>
                <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}</td>
                <td style="text-align:right"><b style="color:var(--accent)">${r.cpu == null ? "—" : r.cpu.toFixed(1) + "%"}</b></td>
                <td style="color:var(--text-dim);white-space:nowrap" title="${esc(r.mem)}">${esc(String(r.mem).split(" / ")[0])}</td>
                <td style="color:var(--text-dim);white-space:nowrap" title="block ${esc(r.block)}">${esc(r.net)}</td>
                <td>${chip(r)}</td></tr>`).join("");
        }

        ctx.setStatus((ctx.remote && ctx.host && ctx.host.label ? "● " + ctx.host.label + " · " : "")
            + eng + ` · ${runN}/${totN} running` + (f ? ` · filter "${f}"` : ""));
        ctx.graph('[data-ref="g"]', "ccpu", { min: 0 });
    },
});
