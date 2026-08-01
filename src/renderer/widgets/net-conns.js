"use strict";
window.I18N.register({
    en: { "widget.netconns": "TCP Connections", "cat.network": "Network" },
    ru: { "widget.netconns": "TCP-соединения", "cat.network": "Сеть" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.netconns = {
    id: "netconns",
    title: "widget.netconns",
    category: "network",
    description: "Active established TCP connections",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div style="display:flex;align-items:center;gap:8px">
                <input class="_nc_filter" placeholder="filter host / process…" style="flex:1;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-family:var(--font-mono)"/>
                <span class="_nc_meta" style="color:var(--text-dim)">…</span>
              </div>
              <div class="_nc_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        const filterEl = $("._nc_filter");
        let alive = true, busy = false, rows = [], filter = "";
        filterEl.addEventListener("input", () => { filter = filterEl.value.trim().toLowerCase(); render(); });

        const parse = (out) => {
            // lsof -nP -iTCP -sTCP:ESTABLISHED  columns: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
            const lines = out.split("\n").filter(l => l.trim());
            const res = [];
            for (let i = 1; i < lines.length; i++) {
                const p = lines[i].trim().split(/\s+/);
                if (p.length < 9) continue;
                const cmd = p[0], pid = p[1], user = p[2];
                const name = p.slice(8).join(" ");
                const m = name.match(/^(.+)->(.+?)(?:\s|$)/);
                let local = name, remote = "";
                if (m) { local = m[1]; remote = m[2]; }
                res.push({ cmd, pid, user, local, remote });
                if (res.length >= 100) break;
            }
            return res;
        };

        const render = () => {
            const list = filter ? rows.filter(r => (r.cmd + " " + r.local + " " + r.remote + " " + r.user).toLowerCase().includes(filter)) : rows;
            $("._nc_meta").textContent = `${list.length}/${rows.length} conn`;
            if (!rows.length) { $("._nc_body").innerHTML = `<div style="padding:10px;color:var(--text-dim)">No established connections (or lsof unavailable).</div>`; return; }
            let html = `<table style="border-collapse:collapse;width:100%;font-family:var(--font-mono);font-size:11.5px"><thead><tr>`;
            ["PROCESS", "PID", "USER", "LOCAL", "REMOTE"].forEach(h => html += `<th style="position:sticky;top:0;background:var(--bg-elevated);text-align:left;padding:5px 8px;border-bottom:1px solid var(--border);color:var(--accent)">${h}</th>`);
            html += `</tr></thead><tbody>`;
            list.forEach(r => {
                html += `<tr>
                    <td style="padding:4px 8px;border-bottom:1px solid var(--border);white-space:nowrap;color:var(--text)">${esc(r.cmd)}</td>
                    <td style="padding:4px 8px;border-bottom:1px solid var(--border);color:var(--text-dim)">${esc(r.pid)}</td>
                    <td style="padding:4px 8px;border-bottom:1px solid var(--border);color:var(--text-dim)">${esc(r.user)}</td>
                    <td style="padding:4px 8px;border-bottom:1px solid var(--border);white-space:nowrap">${esc(r.local)}</td>
                    <td style="padding:4px 8px;border-bottom:1px solid var(--border);white-space:nowrap;color:var(--accent2)">${esc(r.remote)}</td>
                </tr>`;
            });
            html += `</tbody></table>`;
            $("._nc_body").innerHTML = html;
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const r = await window.dyo.exec("lsof", ["-nP", "-iTCP", "-sTCP:ESTABLISHED"], { timeout: 8000 });
                if (!r || (r.code !== 0 && !(r.stdout || "").trim())) {
                    $("._nc_body").innerHTML = `<div style="padding:10px;color:var(--danger)">lsof failed${r && r.stderr ? ": " + esc(r.stderr.trim().split("\n")[0]) : " or not available"}.</div>`;
                    rows = [];
                } else {
                    rows = parse(r.stdout || "");
                    render();
                }
            } catch (e) {
                $("._nc_body").innerHTML = `<div style="padding:10px;color:var(--danger)">Error: ${esc(e && e.message)}</div>`;
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 4000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
