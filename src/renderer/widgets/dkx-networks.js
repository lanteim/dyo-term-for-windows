"use strict";
window.I18N.register({
    en: { "widget.dkx_networks": "Docker Networks", "cat.docker": "Docker" },
    ru: { "widget.dkx_networks": "Docker сети", "cat.docker": "Docker" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.dkx_networks = {
        id: "dkx_networks",
        title: "widget.dkx_networks",
        category: "docker",
        description: "List docker networks",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🐳 NETWORKS</span>
                    <b id="_dkn_n" style="color:var(--accent)">—</b>
                    <span id="_dkn_msg" style="color:var(--text-dim);margin-left:auto"></span>
                  </div>
                  <div id="_dkn_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px"></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const render = (rows) => {
                if (!rows.length) { $("#_dkn_body").innerHTML = `<div style="color:var(--text-dim);padding:10px">No networks.</div>`; return; }
                let html = `<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                    <thead><tr style="text-align:left;color:var(--text-dim)">
                    <th style="padding:5px 8px;position:sticky;top:0;background:var(--bg-elevated)">NAME</th>
                    <th style="padding:5px 8px;position:sticky;top:0;background:var(--bg-elevated)">DRIVER</th>
                    <th style="padding:5px 8px;position:sticky;top:0;background:var(--bg-elevated)">SCOPE</th>
                    </tr></thead><tbody>`;
                rows.slice(0, 200).forEach(r => {
                    html += `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:4px 8px;color:var(--text)">${esc(r.name)}</td>
                        <td style="padding:4px 8px;color:var(--accent2)">${esc(r.driver)}</td>
                        <td style="padding:4px 8px;color:var(--text-dim)">${esc(r.scope)}</td></tr>`;
                });
                html += `</tbody></table>`;
                $("#_dkn_body").innerHTML = html;
            };

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const res = await window.dyo.exec("docker", ["network", "ls", "--format", "{{.Name}}\t{{.Driver}}\t{{.Scope}}"], { timeout: 8000 });
                    if (!res || res.code !== 0) {
                        const err = (res && (res.stderr || "")).toLowerCase();
                        let msg = "docker not available";
                        if (err.includes("cannot connect") || err.includes("daemon")) msg = "daemon not running";
                        else if (err.includes("not found") || (res && res.code === 127)) msg = "docker not found";
                        $("#_dkn_msg").textContent = msg; $("#_dkn_n").textContent = "—";
                        $("#_dkn_body").innerHTML = `<div style="color:var(--text-dim);padding:10px">${esc(msg)}</div>`;
                        return;
                    }
                    $("#_dkn_msg").textContent = "";
                    const rows = res.stdout.split("\n").filter(l => l.trim()).map(l => {
                        const p = l.split("\t"); return { name: p[0] || "", driver: p[1] || "", scope: p[2] || "" };
                    });
                    $("#_dkn_n").textContent = rows.length;
                    render(rows);
                } catch (e) { $("#_dkn_msg").textContent = "error"; } finally { busy = false; }
            };
            tick();
            const iv = setInterval(tick, 6000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
