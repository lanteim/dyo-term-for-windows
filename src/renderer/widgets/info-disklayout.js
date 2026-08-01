"use strict";
window.I18N.register({
    en: { "widget.info_disklayout": "Disk Layout", "cat.system": "System" },
    ru: { "widget.info_disklayout": "Диски", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
    const fmtSize = (b) => {
        if (b == null || isNaN(b) || b <= 0) return "—";
        const u = ["B", "KB", "MB", "GB", "TB", "PB"];
        let i = 0, n = Number(b);
        while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
        return (n >= 100 || i === 0 ? Math.round(n) : n.toFixed(1)) + " " + u[i];
    };

    window.WIDGETS.info_disklayout = {
        id: "info_disklayout",
        title: "widget.info_disklayout",
        category: "system",
        description: "Physical disks: device, type, size",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">💽 DISKS</span>
                    <b class="_n" style="color:var(--accent)">—</b>
                    <span class="_msg" style="color:var(--text-dim);margin-left:auto;font-size:11px"></span>
                  </div>
                  <div class="_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px"></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const render = (rows) => {
                if (!rows.length) { $("._body").innerHTML = `<div style="color:var(--text-dim);padding:10px">No disks.</div>`; return; }
                let h = `<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                    <thead><tr style="text-align:left;color:var(--text-dim)">
                    <th style="padding:5px 8px;position:sticky;top:0;background:var(--bg-elevated)">DEVICE</th>
                    <th style="padding:5px 8px;position:sticky;top:0;background:var(--bg-elevated)">TYPE</th>
                    <th style="padding:5px 8px;position:sticky;top:0;background:var(--bg-elevated);text-align:right">SIZE</th>
                    </tr></thead><tbody>`;
                rows.forEach(r => {
                    const dev = r.device || r.name || "—";
                    const type = [r.type, r.interfaceType].filter(Boolean).join(" / ") || "—";
                    h += `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:4px 8px;color:var(--text)" title="${esc(r.name || '')}">${esc(dev)}</td>
                        <td style="padding:4px 8px;color:var(--text-dim)">${esc(type)}</td>
                        <td style="padding:4px 8px;text-align:right;color:var(--accent)">${esc(fmtSize(r.size))}</td></tr>`;
                });
                h += `</tbody></table>`;
                $("._body").innerHTML = h;
            };

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const d = await window.dyo.si("diskLayout");
                    if (!alive) return;
                    if (!d || d.error) {
                        $("._msg").textContent = "unavailable"; $("._n").textContent = "—";
                        $("._body").innerHTML = `<div style="color:var(--text-dim);padding:10px">Disk layout unavailable.</div>`;
                        return;
                    }
                    const rows = Array.isArray(d) ? d : [d];
                    $("._msg").textContent = "";
                    $("._n").textContent = rows.length;
                    render(rows);
                } catch (e) { if (alive) $("._msg").textContent = "error"; } finally { busy = false; }
            };
            tick();
            const iv = setInterval(tick, 60000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
