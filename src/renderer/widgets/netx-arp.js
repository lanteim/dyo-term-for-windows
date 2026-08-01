"use strict";
window.I18N.register({
    en: { "widget.netx_arp": "ARP Table", "cat.network": "Network" },
    ru: { "widget.netx_arp": "ARP таблица", "cat.network": "Сеть" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.netx_arp = {
        id: "netx_arp",
        title: "widget.netx_arp",
        category: "network",
        description: "ARP neighbor table (ip / mac)",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🖧 ARP</span>
                    <b class="_n" style="color:var(--accent)">—</b>
                    <span class="_msg" style="color:var(--text-dim);margin-left:auto"></span>
                  </div>
                  <div class="_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px"></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false, iv = null;

            const parse = (out) => {
                const rows = [];
                out.split("\n").forEach(l => {
                    // ? (192.168.1.1) at aa:bb:cc:dd:ee:ff on en0 ifscope [ethernet]
                    const m = l.match(/\(([\d.]+)\)\s+at\s+([0-9a-f:]+|\(incomplete\))\s+on\s+(\S+)/i);
                    if (m) {
                        let name = "";
                        const nm = l.match(/^(\S+)\s+\(/);
                        if (nm && nm[1] !== "?") name = nm[1];
                        rows.push({ ip: m[1], mac: m[2], iface: m[3], name });
                    }
                });
                return rows;
            };

            const render = (rows) => {
                if (!rows.length) { $("._body").innerHTML = `<div style="color:var(--text-dim);padding:10px">No ARP entries.</div>`; return; }
                let h = `<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                    <thead><tr style="text-align:left;color:var(--text-dim)">
                    <th style="padding:5px 8px;position:sticky;top:0;background:var(--bg-elevated)">IP</th>
                    <th style="padding:5px 8px;position:sticky;top:0;background:var(--bg-elevated)">MAC</th>
                    <th style="padding:5px 8px;position:sticky;top:0;background:var(--bg-elevated)">IF</th>
                    </tr></thead><tbody>`;
                rows.slice(0, 200).forEach(r => {
                    const inc = /incomplete/i.test(r.mac);
                    h += `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:4px 8px;color:var(--text)">${esc(r.ip)}</td>
                        <td style="padding:4px 8px;color:${inc ? 'var(--text-dim)' : 'var(--accent2)'}">${esc(r.mac)}</td>
                        <td style="padding:4px 8px;color:var(--text-dim)">${esc(r.iface)}</td></tr>`;
                });
                h += `</tbody></table>`;
                $("._body").innerHTML = h;
            };

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const r = await window.dyo.exec("arp", ["-a"], { timeout: 8000 });
                    if (!alive) return;
                    if (!r || (r.code !== 0 && !r.stdout)) {
                        const msg = (r && r.code === 127) ? "arp not found" : "arp unavailable";
                        $("._msg").textContent = msg; $("._n").textContent = "—";
                        $("._body").innerHTML = `<div style="color:var(--text-dim);padding:10px">${esc(msg)}</div>`;
                        return;
                    }
                    $("._msg").textContent = "";
                    const rows = parse(r.stdout || "");
                    $("._n").textContent = rows.length;
                    render(rows);
                } catch (e) { $("._msg").textContent = "error"; } finally { busy = false; }
            };
            tick();
            iv = setInterval(tick, 6000);
            return { destroy: () => { alive = false; if (iv) clearInterval(iv); } };
        }
    };
})();
