"use strict";
window.I18N.register({
    en: { "widget.vpn": "VPN Status", "cat.devops": "DevOps" },
    ru: { "widget.vpn": "Статус VPN", "cat.devops": "DevOps" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.vpn = {
    id: "vpn",
    title: "widget.vpn",
    category: "devops",
    description: "macOS VPN services & WireGuard tunnels",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div style="display:flex;align-items:center;justify-content:space-between">
                <span style="color:var(--text-dim);font-size:11px">🔒 Tunnels</span>
                <span id="_vpn_meta" style="color:var(--text-dim);font-size:11px"></span>
              </div>
              <div id="_vpn_list" style="display:flex;flex-direction:column;gap:4px;overflow:auto;flex:1"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const ex = (cmd, args) => window.dyo.exec(cmd, args, { timeout: 8000 }).catch(() => null);

        const row = (name, state, up) => {
            const div = document.createElement("div");
            div.style.cssText = "display:flex;align-items:center;gap:8px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-elevated)";
            const dot = up ? "var(--accent2)" : "var(--text-dim)";
            div.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:${dot};flex:none"></span>` +
                `<span style="font-family:var(--font-mono);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</span>` +
                `<span style="color:${up ? "var(--accent2)" : "var(--text-dim)"};font-size:11px">${esc(state)}</span>`;
            return div;
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            $("#_vpn_meta").textContent = "…";
            const list = $("#_vpn_list");
            const items = [];
            try {
                // macOS Network Configuration VPN services
                const nc = await ex("scutil", ["--nc", "list"]);
                if (nc && nc.code === 0 && nc.stdout.trim()) {
                    nc.stdout.split(/\r?\n/).forEach(line => {
                        // e.g. * (Connected)   ABCD-... PPP --> "My VPN"
                        const m = /\*?\s*\((Connected|Disconnected|Connecting|Disconnecting|Invalid)\)\s+\S+\s+\S+\s+-->\s+"([^"]+)"/.exec(line);
                        if (m) {
                            const state = m[1], name = m[2];
                            items.push(row(name, state, state === "Connected"));
                        } else {
                            // fallback looser parse
                            const m2 = /\((Connected|Disconnected|Connecting)\).*"([^"]+)"/.exec(line);
                            if (m2) items.push(row(m2[2], m2[1], m2[1] === "Connected"));
                        }
                    });
                }
                // WireGuard
                const wg = await ex("wg", ["show"]);
                if (wg && wg.code === 0 && wg.stdout.trim()) {
                    let iface = "";
                    wg.stdout.split(/\r?\n/).forEach(line => {
                        const mi = /^interface:\s*(\S+)/.exec(line);
                        if (mi) { iface = mi[1]; items.push(row("wg:" + iface, "up", true)); }
                    });
                }
                list.innerHTML = "";
                if (!items.length) {
                    list.innerHTML = `<div style="color:var(--text-dim);padding:6px 0">No VPN services or WireGuard tunnels found.</div>`;
                } else {
                    items.slice(0, 50).forEach(el => list.appendChild(el));
                }
                if (alive) $("#_vpn_meta").textContent = new Date().toLocaleTimeString();
            } catch (e) {
                list.innerHTML = `<div style="color:var(--danger)">Error: ${esc(e && e.message)}</div>`;
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 5000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
