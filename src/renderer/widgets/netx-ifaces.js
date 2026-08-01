"use strict";
window.I18N.register({
    en: { "widget.netx_ifaces": "Interfaces", "cat.network": "Network" },
    ru: { "widget.netx_ifaces": "Интерфейсы", "cat.network": "Сеть" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.netx_ifaces = {
        id: "netx_ifaces",
        title: "widget.netx_ifaces",
        category: "network",
        description: "Network interfaces (iface/ip4/mac/state)",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🔌 IFACES</span>
                    <b class="_n" style="color:var(--accent)">—</b>
                    <span class="_msg" style="color:var(--text-dim);margin-left:auto"></span>
                  </div>
                  <div class="_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px"></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false, iv = null;

            const render = (rows) => {
                if (!rows.length) { $("._body").innerHTML = `<div style="color:var(--text-dim);padding:10px">No interfaces.</div>`; return; }
                let h = `<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                    <thead><tr style="text-align:left;color:var(--text-dim)">
                    <th style="padding:5px 8px;position:sticky;top:0;background:var(--bg-elevated)">IF</th>
                    <th style="padding:5px 8px;position:sticky;top:0;background:var(--bg-elevated)">IPv4</th>
                    <th style="padding:5px 8px;position:sticky;top:0;background:var(--bg-elevated)">MAC</th>
                    <th style="padding:5px 8px;position:sticky;top:0;background:var(--bg-elevated)">STATE</th>
                    </tr></thead><tbody>`;
                rows.slice(0, 200).forEach(r => {
                    const up = String(r.state).toLowerCase() === "up";
                    h += `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:4px 8px;color:var(--text)">${esc(r.iface)}</td>
                        <td style="padding:4px 8px;color:var(--accent2)">${esc(r.ip4 || "—")}</td>
                        <td style="padding:4px 8px;color:var(--text-dim)">${esc(r.mac || "—")}</td>
                        <td style="padding:4px 8px;color:${up ? 'var(--accent2)' : 'var(--text-dim)'}">${esc(r.state)}</td></tr>`;
                });
                h += `</tbody></table>`;
                $("._body").innerHTML = h;
            };

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const data = await window.dyo.si("networkInterfaces");
                    if (!alive) return;
                    if (!data || data.error) {
                        $("._msg").textContent = "unavailable"; $("._n").textContent = "—";
                        $("._body").innerHTML = `<div style="color:var(--text-dim);padding:10px">Interface info unavailable.</div>`;
                        return;
                    }
                    const list = Array.isArray(data) ? data : [data];
                    const rows = list.map(x => ({
                        iface: x.iface || x.ifaceName || "",
                        ip4: x.ip4 || "",
                        mac: x.mac || "",
                        state: x.operstate || (x.default ? "up" : "") || ""
                    })).filter(x => x.iface);
                    // put active/up + with ip first
                    rows.sort((a, b) => (b.ip4 ? 1 : 0) - (a.ip4 ? 1 : 0));
                    $("._msg").textContent = "";
                    $("._n").textContent = rows.length;
                    render(rows);
                } catch (e) { $("._msg").textContent = "error"; } finally { busy = false; }
            };
            tick();
            iv = setInterval(tick, 5000);
            return { destroy: () => { alive = false; if (iv) clearInterval(iv); } };
        }
    };
})();
