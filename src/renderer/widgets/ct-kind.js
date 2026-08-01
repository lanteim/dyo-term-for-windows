"use strict";
window.I18N.register({
    en: { "widget.ct_kind": "kind Clusters", "cat.docker": "Docker" },
    ru: { "widget.ct_kind": "kind Кластеры", "cat.docker": "Docker" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.ct_kind = {
        id: "ct_kind",
        title: "widget.ct_kind",
        category: "docker",
        description: "kind (Kubernetes IN Docker) clusters",
        defaultSize: { w: 5, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">☸️ KIND</span>
                    <span id="_ctkd_sum" style="color:var(--text-dim);margin-left:auto;font-variant-numeric:tabular-nums"></span>
                  </div>
                  <div id="_ctkd_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:2px"></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const diagnose = (res) => {
                const err = ((res && (res.stderr || "")) || "").toLowerCase();
                if (!res || res.code === 127 || err.includes("not found") || err.includes("command not found")) return "kind CLI not installed";
                if (err.includes("cannot connect") || err.includes("docker") || err.includes("daemon")) return "docker daemon not running";
                return "kind not available";
            };

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const res = await window.dyo.exec("kind", ["get", "clusters"], { timeout: 8000 });
                    if (!res || res.code !== 0) {
                        $("#_ctkd_sum").textContent = "";
                        $("#_ctkd_body").innerHTML = `<div style="color:var(--text-dim);padding:10px">${esc(diagnose(res))}</div>`;
                        return;
                    }
                    // "No kind clusters found." goes to stderr but code 0
                    const clusters = res.stdout.split("\n").map(l => l.trim()).filter(l => l && !/no kind clusters/i.test(l));
                    $("#_ctkd_sum").textContent = `${clusters.length} cluster${clusters.length === 1 ? "" : "s"}`;
                    if (!clusters.length) {
                        $("#_ctkd_body").innerHTML = `<div style="color:var(--text-dim);padding:10px">no kind clusters</div>`;
                        return;
                    }
                    let html = "";
                    clusters.slice(0, 200).forEach(c => {
                        html += `<div class="metric-row" style="padding:2px 8px">
                          <span class="k" style="color:var(--text)">${esc(c)}</span>
                          <span class="v" style="color:var(--accent2)">●</span></div>`;
                    });
                    $("#_ctkd_body").innerHTML = html;
                } catch (e) {
                    $("#_ctkd_sum").textContent = "error";
                } finally { busy = false; }
            };
            tick();
            const iv = setInterval(tick, 6000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
