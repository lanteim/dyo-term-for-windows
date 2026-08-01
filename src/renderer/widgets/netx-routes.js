"use strict";
window.I18N.register({
    en: { "widget.netx_routes": "Routes", "cat.network": "Network" },
    ru: { "widget.netx_routes": "Маршруты", "cat.network": "Сеть" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.netx_routes = {
        id: "netx_routes",
        title: "widget.netx_routes",
        category: "network",
        description: "Routing table + default gateway",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🧭 ROUTES</span>
                    <span class="_gw" style="color:var(--accent)">gw —</span>
                    <span class="_msg" style="color:var(--text-dim);margin-left:auto"></span>
                  </div>
                  <div class="_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px"></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false, iv = null;

            const parse = (out) => {
                const rows = [];
                let inV4 = false;
                out.split("\n").forEach(l => {
                    if (/^Internet:/.test(l)) { inV4 = true; return; }
                    if (/^Internet6:/.test(l)) { inV4 = false; return; }
                    if (!inV4) return;
                    if (/^Destination\s+Gateway/i.test(l)) return;
                    const p = l.trim().split(/\s+/);
                    if (p.length >= 3 && p[0] && !/^Routing/i.test(p[0])) {
                        rows.push({ dest: p[0], gw: p[1], flags: p[2], iface: p[p.length - 1] });
                    }
                });
                return rows;
            };

            const render = (rows) => {
                const defs = rows.filter(r => r.dest === "default");
                const def = defs.find(r => /^\d+\.\d+\.\d+\.\d+$/.test(r.gw)) || defs[0];
                $("._gw").textContent = "gw " + (def ? def.gw : "—");
                if (!rows.length) { $("._body").innerHTML = `<div style="color:var(--text-dim);padding:10px">No routes.</div>`; return; }
                let h = `<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                    <thead><tr style="text-align:left;color:var(--text-dim)">
                    <th style="padding:5px 8px;position:sticky;top:0;background:var(--bg-elevated)">DEST</th>
                    <th style="padding:5px 8px;position:sticky;top:0;background:var(--bg-elevated)">GATEWAY</th>
                    <th style="padding:5px 8px;position:sticky;top:0;background:var(--bg-elevated)">IF</th>
                    </tr></thead><tbody>`;
                rows.slice(0, 30).forEach(r => {
                    const isDef = r.dest === "default";
                    h += `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:4px 8px;color:${isDef ? 'var(--accent)' : 'var(--text)'}">${esc(r.dest)}</td>
                        <td style="padding:4px 8px;color:var(--accent2)">${esc(r.gw)}</td>
                        <td style="padding:4px 8px;color:var(--text-dim)">${esc(r.iface)}</td></tr>`;
                });
                h += `</tbody></table>`;
                $("._body").innerHTML = h;
            };

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const r = await window.dyo.exec("netstat", ["-rn"], { timeout: 8000 });
                    if (!alive) return;
                    if (!r || (r.code !== 0 && !r.stdout)) {
                        const msg = (r && r.code === 127) ? "netstat not found" : "netstat unavailable";
                        $("._msg").textContent = msg;
                        $("._body").innerHTML = `<div style="color:var(--text-dim);padding:10px">${esc(msg)}</div>`;
                        return;
                    }
                    $("._msg").textContent = "";
                    render(parse(r.stdout || ""));
                } catch (e) { $("._msg").textContent = "error"; } finally { busy = false; }
            };
            tick();
            iv = setInterval(tick, 6000);
            return { destroy: () => { alive = false; if (iv) clearInterval(iv); } };
        }
    };
})();
