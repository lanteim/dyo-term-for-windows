"use strict";
// A.Petrov-style Proxmox widget: per-node CPU/MEM/DISK, VM + CT counts and the
// cluster quorum state — all via `pvesh get ... --output-format json`. Degrades
// gracefully on hosts without pvesh (macOS/Windows / non-Proxmox).
window.APWidget.define({
    id: "ap-proxmox",
    title: "ap.proxmox.title",
    category: "apetrov",
    description: "Proxmox VE · node load/mem/disk · VM+CT counts · cluster quorum",
    defaultSize: { w: 6, h: 6 },
    interval: 5000,
    ranges: false,
    i18n: {
        en: { "ap.proxmox.title": "Proxmox · A.Petrov" },
        ru: { "ap.proxmox.title": "Proxmox · A.Petrov" },
    },
    settings: [
        { key: "interval", label: "Refresh interval (ms)", type: "number", default: 5000 },
    ],
    render(ctx) {
        ctx.body.innerHTML = `
            <div class="metric-row"><span class="k">CLUSTER</span><span class="v">
                <b data-ref="cname">--</b>
                <span class="apw-chip" data-ref="quorate">--</span>
                <span class="apw-chip" data-ref="cnodes">nodes 0</span>
            </span></div>
            <div class="metric-row"><span class="k">GUESTS</span><span class="v">
                <span class="apw-chip" data-ref="cvm">VM 0/0</span>
                <span class="apw-chip" data-ref="cct">CT 0/0</span>
            </span></div>
            <div class="apw-th">CLUSTER CPU LOAD</div>
            <canvas class="apw-graph" data-ref="g"></canvas>
            <div class="apw-th">NODES</div>
            <table><thead><tr>
                <th style="text-align:left">NODE</th>
                <th style="text-align:left">CPU</th>
                <th style="text-align:left">MEM</th>
                <th style="text-align:left">DISK</th>
            </tr></thead><tbody data-ref="nodes"></tbody></table>`;
    },
    redraw(ctx) { ctx.graph('[data-ref="g"]', "cpu", { min: 0, max: 100 }); },
    async update(ctx) {
        const esc = ctx.fmt.esc;
        const pvesh = (p) => ctx.exec("pvesh", ["get", p, "--output-format", "json"], { timeout: 8000 });
        const parse = (res) => { if (!res || res.code !== 0) return null; try { return JSON.parse(res.stdout || ""); } catch (e) { return null; } };

        // ── primary: node list; no pvesh (macOS/Windows) → not available ──
        let nres;
        try { nres = await pvesh("/nodes"); } catch (e) { nres = null; }
        const nodes = parse(nres);
        if (!Array.isArray(nodes)) return ctx.notAvailable("pvesh not available — Proxmox VE only");

        // ── cluster quorum via /cluster/status (or pvecm status); standalone
        //    nodes return no "cluster" entry, which is expected, not an error ──
        let cluster = null;
        try {
            const cs = parse(await pvesh("/cluster/status"));
            if (Array.isArray(cs)) cluster = cs.find(x => x.type === "cluster") || null;
        } catch (e) { /* standalone / older API */ }

        if (cluster) {
            const q = cluster.quorate === 1 || cluster.quorate === true;
            ctx.ref.cname.textContent = cluster.name || "cluster";
            ctx.ref.quorate.textContent = q ? "quorate" : "no quorum";
            ctx.ref.quorate.className = "apw-chip " + (q ? "ok" : "err");
            ctx.ref.cnodes.textContent = "nodes " + (cluster.nodes != null ? cluster.nodes : nodes.length);
        } else {
            ctx.ref.cname.textContent = nodes.length === 1 ? (nodes[0].node || "standalone") : "standalone";
            ctx.ref.quorate.textContent = "standalone";
            ctx.ref.quorate.className = "apw-chip warn";
            ctx.ref.cnodes.textContent = "nodes " + nodes.length;
        }

        // ── VM + CT counts (running/total) across online nodes ──
        const online = nodes.filter(n => (n.status || "online") !== "offline");
        const counts = await Promise.all(online.map(async n => {
            const [vm, ct] = await Promise.all([
                pvesh("/nodes/" + n.node + "/qemu").then(parse).catch(() => null),
                pvesh("/nodes/" + n.node + "/lxc").then(parse).catch(() => null),
            ]);
            const cnt = (arr) => {
                const a = Array.isArray(arr) ? arr : [];
                return { run: a.filter(x => x.status === "running").length, tot: a.length };
            };
            return { vm: cnt(vm), ct: cnt(ct) };
        }));
        const sum = (sel) => counts.reduce((s, c) => s + sel(c), 0);
        const vmRun = sum(c => c.vm.run), vmTot = sum(c => c.vm.tot);
        const ctRun = sum(c => c.ct.run), ctTot = sum(c => c.ct.tot);
        ctx.ref.cvm.textContent = `VM ${vmRun}/${vmTot}`;
        ctx.ref.cvm.className = "apw-chip " + (vmTot ? "ok" : "");
        ctx.ref.cct.textContent = `CT ${ctRun}/${ctTot}`;
        ctx.ref.cct.className = "apw-chip " + (ctTot ? "ok" : "");

        // ── per-node CPU/MEM/DISK bars + rolling cluster-average CPU graph ──
        let cpuSum = 0;
        ctx.ref.nodes.innerHTML = nodes.map(n => {
            const cpu = Math.round((Number(n.cpu) || 0) * 100);
            cpuSum += cpu;
            const off = (n.status || "online") === "offline";
            const nameCls = off ? "var(--danger)" : "var(--accent)";
            return `<tr>
                <td><b style="color:${nameCls}">${esc(n.node)}</b></td>
                ${cell(cpu, ctx.fmt.pct(cpu))}
                ${cell(pct(n.mem, n.maxmem), ctx.fmt.bytes(n.mem) + " / " + ctx.fmt.bytes(n.maxmem))}
                ${cell(pct(n.disk, n.maxdisk), ctx.fmt.bytes(n.disk) + " / " + ctx.fmt.bytes(n.maxdisk))}</tr>`;
        }).join("");

        const avg = nodes.length ? Math.round(cpuSum / nodes.length) : 0;
        ctx.push("cpu", avg);
        ctx.graph('[data-ref="g"]', "cpu", { min: 0, max: 100 });

        ctx.setStatus(`${nodes.length} node${nodes.length === 1 ? "" : "s"} · VM ${vmRun}/${vmTot} · CT ${ctRun}/${ctTot}`);
    },
});

// percent of a used/max pair, clamped 0..100
function pct(used, max) {
    used = Number(used) || 0; max = Number(max) || 0;
    return max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
}
// a table cell: a bar (red when saturated) with a dim caption underneath
function cell(p, caption) {
    const danger = p >= 90 ? "background:var(--danger)" : "";
    return `<td style="min-width:88px"><div class="bar" title="${p}%"><i style="width:${p}%;${danger}"></i></div>`
        + `<span style="color:var(--text-dim);font-size:10px">${caption}</span></td>`;
}
