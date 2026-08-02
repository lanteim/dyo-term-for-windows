"use strict";
window.I18N.register({
    en: { "widget.k8sctx": "K8s Context", "cat.kubernetes": "Kubernetes" },
    ru: { "widget.k8sctx": "K8s контекст", "cat.kubernetes": "Kubernetes" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.k8sctx = {
    id: "k8sctx",
    title: "widget.k8sctx",
    category: "kubernetes",
    description: "Current context & namespace; click a context to switch",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const shq = s => "'" + String(s).replace(/'/g, "'\\''") + "'";
        body.innerHTML = `
            <div class="metric-row"><span class="k">⎈ CONTEXT</span><span class="v"><b id="_k8c_ctx">…</b></span></div>
            <div class="metric-row"><span class="k">NAMESPACE</span><span class="v" id="_k8c_ns">…</span></div>
            <div id="_k8c_msg" style="color:var(--text-dim);font-size:11px;margin:6px 0 4px"></div>
            <div id="_k8c_list" style="display:flex;flex-direction:column;gap:3px;overflow:auto;max-height:120px"></div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const kc = (args) => window.dyo.exec("kubectl", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 8000 });

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const cur = await kc(["config", "current-context"]);
                if (!cur || cur.code !== 0) {
                    $("#_k8c_ctx").textContent = "—";
                    $("#_k8c_ns").textContent = "—";
                    $("#_k8c_msg").textContent = "kubectl not found — install to enable";
                    $("#_k8c_list").innerHTML = "";
                    return;
                }
                const current = (cur.stdout || "").trim();
                $("#_k8c_ctx").textContent = current || "—";
                const [ns, ctxs] = await Promise.all([
                    kc(["config", "view", "--minify", "-o", "jsonpath={..namespace}"]),
                    kc(["config", "get-contexts", "-o", "name"])
                ]);
                $("#_k8c_ns").textContent = (ns && ns.code === 0 && ns.stdout.trim()) ? ns.stdout.trim() : "default";
                $("#_k8c_msg").textContent = "switch context:";
                const list = $("#_k8c_list");
                list.innerHTML = "";
                const names = (ctxs && ctxs.code === 0 ? ctxs.stdout : "").split("\n").map(s => s.trim()).filter(Boolean).slice(0, 60);
                if (!names.length) { $("#_k8c_msg").textContent = ""; return; }
                names.forEach(name => {
                    const row = document.createElement("div");
                    const active = name === current;
                    row.textContent = (active ? "● " : "○ ") + name;
                    row.title = active ? "current context" : "Click to: kubectl config use-context " + name;
                    row.style.cssText = "font-family:var(--font-mono);font-size:11.5px;padding:3px 7px;border:1px solid var(--border);border-radius:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:var(--bg-elevated);cursor:" + (active ? "default" : "pointer") + ";color:" + (active ? "var(--accent2)" : "var(--text)");
                    if (!active) row.onclick = () => window.term && window.term.runInFocused("kubectl config use-context " + shq(name) + "\n");
                    list.appendChild(row);
                });
            } catch (e) {
                $("#_k8c_msg").textContent = "error: " + esc(e && e.message);
            } finally {
                busy = false;
            }
        };
        tick();
        const iv = setInterval(tick, 5000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
