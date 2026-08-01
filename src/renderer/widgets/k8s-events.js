"use strict";
window.I18N.register({
    en: { "widget.k8sevents": "K8s Events", "cat.kubernetes": "Kubernetes" },
    ru: { "widget.k8sevents": "K8s события", "cat.kubernetes": "Kubernetes" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.k8sevents = {
    id: "k8sevents",
    title: "widget.k8sevents",
    category: "kubernetes",
    description: "Recent cluster events across all namespaces",
    defaultSize: { w: 12, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">📣 EVENTS (recent)</span><span class="v" id="_k8e_sum"></span></div>
            <div id="_k8e_msg" style="color:var(--text-dim);font-size:11px;margin:4px 0"></div>
            <div id="_k8e_list" style="overflow:auto;max-height:100%;font-family:var(--font-mono);font-size:11.5px"></div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const kc = (args) => window.dyo.exec("kubectl", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 8000 });

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const r = await kc(["get", "events", "--sort-by=.lastTimestamp", "-A", "--no-headers"]);
                if (!r || r.code !== 0) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n")[0] : "kubectl not found — install to enable";
                    $("#_k8e_msg").textContent = err;
                    $("#_k8e_list").innerHTML = "";
                    $("#_k8e_sum").textContent = "";
                    return;
                }
                $("#_k8e_msg").textContent = "";
                const all = (r.stdout || "").split("\n").map(l => l.trim()).filter(Boolean);
                const lines = all.slice(-12).reverse();
                if (!lines.length) {
                    $("#_k8e_list").innerHTML = `<div style="color:var(--text-dim)">no recent events</div>`;
                    $("#_k8e_sum").textContent = "";
                    return;
                }
                let warns = 0;
                const html = lines.map(l => {
                    const c = l.split(/\s+/);
                    // columns: NAMESPACE LAST-SEEN TYPE REASON OBJECT ... MESSAGE
                    const ns = c[0] || "", last = c[1] || "", type = c[2] || "", reason = c[3] || "", obj = c[4] || "";
                    const msg = c.slice(5).join(" ");
                    const warn = type === "Warning";
                    if (warn) warns++;
                    const tc = warn ? "var(--danger)" : "var(--accent2)";
                    return `<div style="padding:3px 4px;border-top:1px solid var(--border);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                        <span style="color:var(--text-dim)">${esc(last)}</span>
                        <span style="color:${tc}">${esc(type)}</span>
                        <span style="color:var(--accent)">${esc(reason)}</span>
                        <span style="color:var(--text-dim)">${esc(ns)}/${esc(obj)}</span>
                        <span>${esc(msg)}</span></div>`;
                }).join("");
                $("#_k8e_list").innerHTML = html;
                $("#_k8e_sum").innerHTML = warns > 0
                    ? `<b style="color:var(--danger)">${warns} warning${warns > 1 ? "s" : ""}</b>`
                    : `<span style="color:var(--accent2)">normal</span>`;
            } catch (e) {
                $("#_k8e_msg").textContent = "error: " + esc(e && e.message);
            } finally {
                busy = false;
            }
        };
        tick();
        const iv = setInterval(tick, 5000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
