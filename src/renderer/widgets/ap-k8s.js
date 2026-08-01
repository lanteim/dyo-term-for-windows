"use strict";
// A.Petrov-style Kubernetes widget: current context, pod phases, ready nodes,
// deployment/namespace counts. Reads kubectl -o json; degrades when kubectl is
// missing or the cluster is unreachable.
window.APWidget.define({
    id: "ap-k8s",
    title: "ap.k8s.title",
    category: "apetrov",
    description: "Cluster context · pod phases · ready nodes · deploy/ns counts",
    defaultSize: { w: 6, h: 6 },
    interval: 5000,
    ranges: false,
    i18n: {
        en: { "ap.k8s.title": "Kubernetes · A.Petrov" },
        ru: { "ap.k8s.title": "Kubernetes · A.Petrov" },
    },
    settings: [
        { key: "interval", label: "Refresh interval (ms)", type: "number", default: 5000 },
        { key: "namespace", label: "Namespace (blank = all)", type: "text", default: "", placeholder: "all namespaces" },
    ],
    render(ctx) {
        ctx.body.innerHTML = `
            <div class="metric-row"><span class="k">⎈ CONTEXT</span><span class="v"><b data-ref="ctx">…</b></span></div>
            <div class="apw-th">Pods by phase</div>
            <div data-ref="chips" style="display:flex;gap:6px;flex-wrap:wrap"></div>
            <canvas class="apw-graph" data-ref="g" style="margin-top:8px"></canvas>
            <div class="apw-th">Cluster</div>
            <div class="apw-kv">
                <span class="k">Nodes ready</span><span class="v"><b data-ref="nodes">—</b></span>
                <span class="k">Pods total</span><span class="v"><b data-ref="pods">—</b></span>
                <span class="k">Deployments</span><span class="v"><b data-ref="deps">—</b></span>
                <span class="k">Namespaces</span><span class="v"><b data-ref="ns">—</b></span>
                <span class="k">Scope</span><span class="v" data-ref="scope">—</span>
            </div>`;
    },
    redraw(ctx) { ctx.graph('[data-ref="g"]', "running", { min: 0 }); },
    async update(ctx) {
        const kc = (args) => ctx.exec("kubectl", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 8000 });
        const firstLine = s => String(s || "").trim().split("\n")[0];
        const parse = r => { if (!r || r.code !== 0) return null; try { return JSON.parse(r.stdout || "{}"); } catch (e) { return null; } };

        // ── kubectl presence check (config read works offline) ──
        let cur;
        try { cur = await kc(["config", "current-context"]); } catch (e) { cur = null; }
        const missing = !cur || cur.code === 127 || /command not found|not found|no such file|enoent|spawn/i.test((cur.stderr || "") + (cur.error || ""));
        if (missing) { ctx.notAvailable("kubectl not found — install & configure a cluster to enable"); return; }
        const ctxName = (cur.code === 0 && cur.stdout.trim()) ? cur.stdout.trim() : "—";
        ctx.ref.ctx.textContent = ctxName;

        // ── scope: optional namespace, otherwise all namespaces ──
        const ns = (ctx.settings.namespace || "").trim();
        const nsArgs = ns ? ["-n", ns] : ["-A"];
        ctx.ref.scope.textContent = ns || "all namespaces";

        const [rPods, rNodes, rDeps, rNss] = await Promise.all([
            kc(["get", "pods", ...nsArgs, "-o", "json"]),
            kc(["get", "nodes", "-o", "json"]),
            kc(["get", "deployments", ...nsArgs, "-o", "json"]),
            kc(["get", "namespaces", "-o", "json"]),
        ]);
        const pods = parse(rPods), nodes = parse(rNodes), deps = parse(rDeps), nss = parse(rNss);

        // ── cluster unreachable: kubectl exists but no data came back ──
        if (!pods && !nodes) {
            ctx.setStatus(firstLine((rPods && rPods.stderr) || (rNodes && rNodes.stderr)) || "cluster unreachable", "err");
            ctx.ref.chips.innerHTML = `<span class="apw-chip">no data</span>`;
            ["nodes", "pods", "deps", "ns"].forEach(k => ctx.ref[k].textContent = "—");
            return;
        }
        ctx.setStatus("");

        // ── pod phase counts → chips ──
        const items = (pods && pods.items) || [];
        let run = 0, pend = 0, fail = 0;
        items.forEach(p => {
            const ph = p.status && p.status.phase;
            if (ph === "Running") run++;
            else if (ph === "Pending") pend++;
            else if (ph === "Failed") fail++;
        });
        ctx.ref.chips.innerHTML =
            `<span class="apw-chip ok">Running ${run}</span>` +
            `<span class="apw-chip ${pend ? "warn" : ""}">Pending ${pend}</span>` +
            `<span class="apw-chip ${fail ? "err" : ""}">Failed ${fail}</span>`;
        ctx.ref.pods.textContent = pods ? items.length : "—";

        // ── ready node count ──
        const nItems = (nodes && nodes.items) || [];
        let ready = 0;
        nItems.forEach(n => {
            const cs = (n.status && n.status.conditions) || [];
            if (cs.some(c => c.type === "Ready" && c.status === "True")) ready++;
        });
        ctx.ref.nodes.textContent = nodes ? `${ready}/${nItems.length}` : "—";

        // ── deployment & namespace counts ──
        ctx.ref.deps.textContent = deps ? ((deps.items || []).length) : "—";
        ctx.ref.ns.textContent = nss ? ((nss.items || []).length) : "—";

        // ── live running-pods chart ──
        ctx.push("running", run);
        ctx.graph('[data-ref="g"]', "running", { min: 0 });
    },
});
