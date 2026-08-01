"use strict";
window.I18N.register({
    en: { "widget.dkx_prune": "Docker Prune", "cat.docker": "Docker" },
    ru: { "widget.dkx_prune": "Docker очистка", "cat.docker": "Docker" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.dkx_prune = {
        id: "dkx_prune",
        title: "widget.dkx_prune",
        category: "docker",
        description: "Show reclaimable space and prune",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🐳 DISK / PRUNE</span>
                    <span id="_dkp_msg" style="color:var(--text-dim);margin-left:auto"></span>
                  </div>
                  <div id="_dkp_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:6px"></div>
                  <div style="display:flex;gap:6px">
                    <button id="_dkp_refresh" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;cursor:pointer">Refresh</button>
                    <button id="_dkp_prune" style="background:var(--danger);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 12px;cursor:pointer;margin-left:auto">Prune -f</button>
                  </div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const render = (rows) => {
                if (!rows.length) { $("#_dkp_body").innerHTML = `<div style="color:var(--text-dim)">No data.</div>`; return; }
                let html = `<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                    <thead><tr style="text-align:left;color:var(--text-dim)">
                    <th style="padding:3px 6px">TYPE</th><th style="padding:3px 6px">SIZE</th><th style="padding:3px 6px">RECLAIMABLE</th>
                    </tr></thead><tbody>`;
                rows.forEach(r => {
                    html += `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:3px 6px;color:var(--text)">${esc(r.type)}</td>
                        <td style="padding:3px 6px;color:var(--text-dim)">${esc(r.size)}</td>
                        <td style="padding:3px 6px;color:var(--accent2)">${esc(r.reclaim)}</td></tr>`;
                });
                html += `</tbody></table>`;
                $("#_dkp_body").innerHTML = html;
            };

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const res = await window.dyo.exec("docker", ["system", "df", "--format", "{{.Type}}\t{{.Size}}\t{{.Reclaimable}}"], { timeout: 9000 });
                    if (!res || res.code !== 0) {
                        const err = (res && (res.stderr || "")).toLowerCase();
                        let msg = "docker not available";
                        if (err.includes("cannot connect") || err.includes("daemon")) msg = "daemon not running";
                        else if (err.includes("not found") || (res && res.code === 127)) msg = "docker not found";
                        $("#_dkp_msg").textContent = msg;
                        $("#_dkp_body").innerHTML = `<div style="color:var(--text-dim)">${esc(msg)}</div>`;
                        return;
                    }
                    $("#_dkp_msg").textContent = "";
                    const rows = res.stdout.split("\n").filter(l => l.trim()).map(l => {
                        const p = l.split("\t"); return { type: p[0] || "", size: p[1] || "", reclaim: p[2] || "" };
                    });
                    render(rows);
                } catch (e) { $("#_dkp_msg").textContent = "error"; } finally { busy = false; }
            };

            $("#_dkp_refresh").addEventListener("click", tick);
            $("#_dkp_prune").addEventListener("click", () => {
                window.term.runInFocused("docker system prune -f\n");
                $("#_dkp_msg").textContent = "prune sent to terminal";
            });
            tick();
            const iv = setInterval(tick, 6000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
