"use strict";
window.I18N.register({
    en: { "widget.dockerimages": "Docker Images", "cat.docker": "Docker" },
    ru: { "widget.dockerimages": "Docker образы", "cat.docker": "Docker" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.dockerimages = {
        id: "dockerimages",
        title: "widget.dockerimages",
        category: "docker",
        description: "Local Docker images",
        defaultSize: { w: 6, h: 4 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">💿 IMAGES</span>
                    <b id="_dkim_n" style="color:var(--accent)">—</b>
                    <span id="_dkim_msg" style="color:var(--text-dim);margin-left:auto"></span>
                  </div>
                  <div id="_dkim_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px"></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const render = (rows) => {
                if (!rows.length) {
                    $("#_dkim_body").innerHTML = `<div style="color:var(--text-dim);padding:10px">No images.</div>`;
                    return;
                }
                let html = `<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                    <thead><tr style="text-align:left;color:var(--text-dim)">
                    <th style="padding:5px 8px;position:sticky;top:0;background:var(--bg-elevated)">REPOSITORY:TAG</th>
                    <th style="padding:5px 8px;position:sticky;top:0;background:var(--bg-elevated);text-align:right">SIZE</th>
                    </tr></thead><tbody>`;
                rows.slice(0, 200).forEach(r => {
                    html += `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:4px 8px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:0">${esc(r.name)}</td>
                        <td style="padding:4px 8px;color:var(--text-dim);text-align:right;white-space:nowrap">${esc(r.size)}</td></tr>`;
                });
                html += `</tbody></table>`;
                $("#_dkim_body").innerHTML = html;
            };

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const res = await window.dyo.exec("docker", ["images", "--format", "{{.Repository}}:{{.Tag}}\t{{.Size}}"], { timeout: 8000 });
                    if (!res || res.code !== 0) {
                        const err = (res && (res.stderr || "")).toLowerCase();
                        let msg = "docker not available";
                        if (err.includes("cannot connect") || err.includes("daemon")) msg = "docker daemon not running";
                        else if (err.includes("not found") || (res && res.code === 127)) msg = "docker not found";
                        $("#_dkim_msg").textContent = msg;
                        $("#_dkim_n").textContent = "—";
                        $("#_dkim_body").innerHTML = `<div style="color:var(--text-dim);padding:10px">${esc(msg)}</div>`;
                        return;
                    }
                    $("#_dkim_msg").textContent = "";
                    const rows = res.stdout.split("\n").filter(l => l.trim()).map(l => {
                        const p = l.split("\t");
                        return { name: p[0] || "", size: p[1] || "" };
                    });
                    $("#_dkim_n").textContent = rows.length;
                    render(rows);
                } catch (e) {
                    $("#_dkim_msg").textContent = "error";
                } finally { busy = false; }
            };
            tick();
            const iv = setInterval(tick, 8000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
