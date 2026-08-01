"use strict";
window.I18N.register({
    en: { "widget.netports": "Listening Ports", "cat.network": "Network" },
    ru: { "widget.netports": "Открытые порты", "cat.network": "Сеть" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.netports = {
    id: "netports",
    title: "widget.netports",
    category: "network",
    description: "TCP ports in LISTEN state and their process",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="color:var(--text-dim)" data-i18n="widget.netports">LISTEN</span>
                <span class="_np_meta" style="color:var(--text-dim);margin-left:auto">…</span>
              </div>
              <div class="_np_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;

        const parse = (out) => {
            const lines = out.split("\n").filter(l => l.trim());
            const seen = new Set(), res = [];
            for (let i = 1; i < lines.length; i++) {
                const p = lines[i].trim().split(/\s+/);
                if (p.length < 9) continue;
                const cmd = p[0], pid = p[1], user = p[2];
                const name = p.slice(8).join(" ").replace(/\s*\(LISTEN\)\s*$/, "");
                const addr = name.split(/\s+/)[0];
                const pm = addr.match(/:(\d+|\*)$/);
                const port = pm ? pm[1] : addr;
                const host = pm ? addr.slice(0, addr.length - pm[0].length) : "";
                const key = port + "|" + cmd + "|" + pid;
                if (seen.has(key)) continue;
                seen.add(key);
                res.push({ port, host, cmd, pid, user });
                if (res.length >= 200) break;
            }
            res.sort((a, b) => (parseInt(a.port) || 1e9) - (parseInt(b.port) || 1e9));
            return res;
        };

        const render = (rows) => {
            $("._np_meta").textContent = `${rows.length} port` + (rows.length === 1 ? "" : "s");
            if (!rows.length) { $("._np_body").innerHTML = `<div style="padding:10px;color:var(--text-dim)">No listening ports (or lsof unavailable).</div>`; return; }
            let html = `<table style="border-collapse:collapse;width:100%;font-family:var(--font-mono);font-size:11.5px"><thead><tr>`;
            ["PORT", "HOST", "PROCESS", "PID"].forEach(h => html += `<th style="position:sticky;top:0;background:var(--bg-elevated);text-align:left;padding:5px 8px;border-bottom:1px solid var(--border);color:var(--accent)">${h}</th>`);
            html += `</tr></thead><tbody>`;
            rows.forEach(r => {
                html += `<tr>
                    <td style="padding:4px 8px;border-bottom:1px solid var(--border);color:var(--accent2);font-weight:600">${esc(r.port)}</td>
                    <td style="padding:4px 8px;border-bottom:1px solid var(--border);color:var(--text-dim)">${esc(r.host || "*")}</td>
                    <td style="padding:4px 8px;border-bottom:1px solid var(--border);white-space:nowrap">${esc(r.cmd)}</td>
                    <td style="padding:4px 8px;border-bottom:1px solid var(--border);color:var(--text-dim)">${esc(r.pid)}</td>
                </tr>`;
            });
            html += `</tbody></table>`;
            $("._np_body").innerHTML = html;
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const r = await window.dyo.exec("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN"], { timeout: 8000 });
                if (!r || (r.code !== 0 && !(r.stdout || "").trim())) {
                    $("._np_body").innerHTML = `<div style="padding:10px;color:var(--danger)">lsof failed${r && r.stderr ? ": " + esc(r.stderr.trim().split("\n")[0]) : " or not available"}.</div>`;
                } else {
                    render(parse(r.stdout || ""));
                }
            } catch (e) {
                $("._np_body").innerHTML = `<div style="padding:10px;color:var(--danger)">Error: ${esc(e && e.message)}</div>`;
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 5000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
