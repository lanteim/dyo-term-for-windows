"use strict";
window.I18N.register({
    en: { "widget.ct_skaffold": "Skaffold", "cat.docker": "Docker" },
    ru: { "widget.ct_skaffold": "Skaffold", "cat.docker": "Docker" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.ct_skaffold = {
        id: "ct_skaffold",
        title: "widget.ct_skaffold",
        category: "docker",
        description: "Skaffold version & config in current dir",
        defaultSize: { w: 5, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🏗️ SKAFFOLD</span>
                    <span id="_ctsk_sum" style="color:var(--text-dim);margin-left:auto"></span>
                  </div>
                  <div id="_ctsk_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:4px"></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const diagnose = (res) => {
                const err = ((res && (res.stderr || "")) || "").toLowerCase();
                if (!res || res.code === 127 || err.includes("not found") || err.includes("command not found")) return "skaffold CLI not installed";
                return "skaffold not available";
            };

            const findCfg = async (cwd) => {
                if (!cwd || !window.dyo.fs || !window.dyo.fs.list) return null;
                try {
                    const items = await window.dyo.fs.list(cwd);
                    if (!Array.isArray(items)) return null;
                    const names = items.map(i => (typeof i === "string" ? i : (i && i.name) || "")).filter(Boolean);
                    const hit = names.find(n => /^skaffold\.ya?ml$/i.test(n));
                    return hit || null;
                } catch (e) { return null; }
            };

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const cwd = window.term ? window.term.lastCwd : undefined;
                    const [ver, cfg] = await Promise.all([
                        window.dyo.exec("skaffold", ["version"], { timeout: 8000 }),
                        findCfg(cwd)
                    ]);
                    if (!ver || ver.code !== 0) {
                        $("#_ctsk_sum").textContent = "";
                        $("#_ctsk_body").innerHTML = `<div style="color:var(--text-dim);padding:10px">${esc(diagnose(ver))}</div>`;
                        return;
                    }
                    const v = (ver.stdout || "").trim().split("\n")[0] || "?";
                    $("#_ctsk_sum").textContent = esc(v);
                    let html = "";
                    html += `<div class="metric-row"><span class="k">version</span><span class="v" style="color:var(--text)">${esc(v)}</span></div>`;
                    html += `<div class="metric-row"><span class="k">cwd</span><span class="v" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%">${esc(cwd || "?")}</span></div>`;
                    if (cfg) {
                        html += `<div class="metric-row"><span class="k">config</span><span class="v" style="color:var(--accent2)">${esc(cfg)}</span></div>`;
                    } else {
                        html += `<div class="metric-row"><span class="k">config</span><span class="v" style="color:var(--text-dim)">none in cwd</span></div>`;
                    }
                    $("#_ctsk_body").innerHTML = html;
                } catch (e) {
                    $("#_ctsk_sum").textContent = "error";
                } finally { busy = false; }
            };
            tick();
            const iv = setInterval(tick, 6000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
