"use strict";
window.I18N.register({
    en: { "widget.ct_minikube": "minikube", "cat.docker": "Docker" },
    ru: { "widget.ct_minikube": "minikube", "cat.docker": "Docker" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.ct_minikube = {
        id: "ct_minikube",
        title: "widget.ct_minikube",
        category: "docker",
        description: "minikube cluster status",
        defaultSize: { w: 5, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🎡 MINIKUBE</span>
                    <span id="_ctmk_sum" style="margin-left:auto"></span>
                  </div>
                  <div id="_ctmk_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:4px"><div style="color:var(--text-dim);padding:10px">Loading…</div></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const diagnose = (res) => {
                const err = ((res && (res.stderr || "")) || "").toLowerCase();
                if (!res || res.code === 127 || err.includes("not found") || err.includes("command not found")) return "minikube CLI not installed";
                return null;
            };
            const badge = (v) => {
                const ok = /running|configured|healthy/i.test(v);
                const col = ok ? "var(--accent2)" : (/stopped|nonexistent|misconfigured|error/i.test(v) ? "var(--danger)" : "var(--text-dim)");
                return `<span class="v" style="color:${col}">${esc(v || "?")}</span>`;
            };

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    // minikube status returns non-zero when stopped; capture stdout regardless
                    const res = await window.dyo.exec("minikube", ["status", "-o", "json"], { timeout: 8000 });
                    const notInstalled = diagnose(res);
                    if (notInstalled) {
                        $("#_ctmk_sum").textContent = "";
                        $("#_ctmk_body").innerHTML = `<div style="color:var(--text-dim);padding:10px">${esc(notInstalled)}</div>`;
                        return;
                    }
                    let st = null;
                    try { st = JSON.parse((res.stdout || "").trim()); } catch (e) { }
                    if (Array.isArray(st)) st = st[0];
                    if (!st) {
                        // Probably no profile / not started
                        $("#_ctmk_sum").innerHTML = `<span style="color:var(--danger)">stopped</span>`;
                        $("#_ctmk_body").innerHTML = `<div style="color:var(--text-dim);padding:10px">no cluster · start with <code>minikube start</code></div>`;
                        return;
                    }
                    const host = st.Host || "?";
                    const ok = /running/i.test(host);
                    $("#_ctmk_sum").innerHTML = ok ? `<span style="color:var(--accent2)">running</span>` : `<span style="color:var(--danger)">${esc(host)}</span>`;
                    let html = "";
                    html += `<div class="metric-row"><span class="k">name</span><span class="v" style="color:var(--text)">${esc(st.Name || "minikube")}</span></div>`;
                    html += `<div class="metric-row"><span class="k">host</span>${badge(st.Host)}</div>`;
                    html += `<div class="metric-row"><span class="k">kubelet</span>${badge(st.Kubelet)}</div>`;
                    html += `<div class="metric-row"><span class="k">apiserver</span>${badge(st.APIServer)}</div>`;
                    html += `<div class="metric-row"><span class="k">kubeconfig</span>${badge(st.Kubeconfig)}</div>`;
                    $("#_ctmk_body").innerHTML = html;
                } catch (e) {
                    $("#_ctmk_sum").textContent = "error";
                } finally { busy = false; }
            };
            tick();
            const iv = setInterval(tick, 6000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
