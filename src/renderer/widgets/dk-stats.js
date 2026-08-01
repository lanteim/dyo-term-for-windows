"use strict";
window.I18N.register({
    en: { "widget.dockerstats": "Docker Stats", "cat.docker": "Docker" },
    ru: { "widget.dockerstats": "Docker статистика", "cat.docker": "Docker" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.dockerstats = {
        id: "dockerstats",
        title: "widget.dockerstats",
        category: "docker",
        description: "Per-container CPU / memory",
        defaultSize: { w: 12, h: 4 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">📊 STATS</span>
                    <b id="_dkst_n" style="color:var(--accent)">—</b>
                    <span id="_dkst_msg" style="color:var(--text-dim);margin-left:auto"></span>
                  </div>
                  <div id="_dkst_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px"><div style="color:var(--text-dim);padding:10px">Loading…</div></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const render = (rows) => {
                if (!rows.length) {
                    $("#_dkst_body").innerHTML = `<div style="color:var(--text-dim);padding:10px">No running containers.</div>`;
                    return;
                }
                let html = `<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                    <thead><tr style="text-align:left;color:var(--text-dim)">
                    <th style="padding:5px 8px;position:sticky;top:0;background:var(--bg-elevated)">NAME</th>
                    <th style="padding:5px 8px;position:sticky;top:0;background:var(--bg-elevated)">CPU</th>
                    <th style="padding:5px 8px;position:sticky;top:0;background:var(--bg-elevated);width:30%">CPU %</th>
                    <th style="padding:5px 8px;position:sticky;top:0;background:var(--bg-elevated)">MEM</th>
                    </tr></thead><tbody>`;
                rows.slice(0, 200).forEach(r => {
                    const pct = Math.max(0, Math.min(100, parseFloat(r.cpu) || 0));
                    const col = pct > 80 ? "var(--danger)" : "var(--accent)";
                    html += `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:4px 8px;color:var(--text)">${esc(r.name)}</td>
                        <td style="padding:4px 8px;color:var(--text);text-align:right">${esc(r.cpu)}</td>
                        <td style="padding:4px 8px"><div class="bar" style="background:var(--border);height:8px;border-radius:4px;overflow:hidden"><i style="display:block;height:100%;width:${pct}%;background:${col}"></i></div></td>
                        <td style="padding:4px 8px;color:var(--text-dim)">${esc(r.mem)}</td></tr>`;
                });
                html += `</tbody></table>`;
                $("#_dkst_body").innerHTML = html;
            };

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const res = await window.dyo.exec("docker", ["stats", "--no-stream", "--format", "{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"], { timeout: 12000 });
                    if (!res || res.code !== 0) {
                        const err = (res && (res.stderr || "")).toLowerCase();
                        let msg = "docker not available";
                        if (err.includes("cannot connect") || err.includes("daemon")) msg = "docker daemon not running";
                        else if (err.includes("not found") || (res && res.code === 127)) msg = "docker not found";
                        $("#_dkst_msg").textContent = msg;
                        $("#_dkst_n").textContent = "—";
                        $("#_dkst_body").innerHTML = `<div style="color:var(--text-dim);padding:10px">${esc(msg)}</div>`;
                        return;
                    }
                    $("#_dkst_msg").textContent = "";
                    const rows = res.stdout.split("\n").filter(l => l.trim()).map(l => {
                        const p = l.split("\t");
                        return { name: p[0] || "", cpu: p[1] || "", mem: p[2] || "" };
                    });
                    $("#_dkst_n").textContent = rows.length;
                    render(rows);
                } catch (e) {
                    $("#_dkst_msg").textContent = "error";
                } finally { busy = false; }
            };
            tick();
            const iv = setInterval(tick, 5000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
