"use strict";
window.I18N.register({
    en: { "widget.info_hostip": "Host & IP", "cat.system": "System" },
    ru: { "widget.info_hostip": "Хост и IP", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.info_hostip = {
        id: "info_hostip",
        title: "widget.info_hostip",
        category: "system",
        description: "Hostname and default interface IPv4 / IPv6 / MAC",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🌍 HOST</span>
                    <b class="_host" style="color:var(--accent);cursor:pointer" title="Click to copy">—</b>
                    <span class="_msg" style="color:var(--text-dim);margin-left:auto;font-size:11px"></span>
                  </div>
                  <div class="metric-row"><span class="k">IFACE</span><span class="v _if" style="font-family:var(--font-mono)">—</span></div>
                  <div class="metric-row"><span class="k">IPv4</span><span class="v _ip4" style="font-family:var(--font-mono);cursor:pointer" title="Click to copy">—</span></div>
                  <div class="metric-row"><span class="k">IPv6</span><span class="v _ip6" style="font-family:var(--font-mono);cursor:pointer;max-width:66%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="Click to copy">—</span></div>
                  <div class="metric-row"><span class="k">MAC</span><span class="v _mac" style="font-family:var(--font-mono);cursor:pointer" title="Click to copy">—</span></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const copyEl = (sel) => { const t = $(sel).textContent.trim(); if (t && t !== "—") navigator.clipboard.writeText(t).catch(() => {}); };
            ["._host", "._ip4", "._ip6", "._mac"].forEach(sel => { $(sel).onclick = () => copyEl(sel); });

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const [info, nets] = await Promise.all([
                        window.dyo.appInfo(),
                        window.dyo.si("networkInterfaces")
                    ]);
                    if (!alive) return;
                    $("._host").textContent = (info && info.hostname) || "—";

                    const list = Array.isArray(nets) ? nets : (nets ? [nets] : []);
                    let iface = list.find(x => x && x.default);
                    if (!iface) iface = list.filter(x => x && x.ip4 && !x.internal).sort((a, b) => (String(b.operstate).toLowerCase() === "up" ? 1 : 0) - (String(a.operstate).toLowerCase() === "up" ? 1 : 0))[0];
                    if (!iface) iface = list.find(x => x && x.ip4);

                    if (iface) {
                        $("._if").textContent = iface.iface || "—";
                        $("._ip4").textContent = iface.ip4 || "—";
                        $("._ip6").textContent = iface.ip6 || "—";
                        $("._ip6").title = iface.ip6 || "";
                        $("._mac").textContent = iface.mac || "—";
                        $("._msg").textContent = "";
                    } else {
                        $("._if").textContent = "—"; $("._ip4").textContent = "—"; $("._ip6").textContent = "—"; $("._mac").textContent = "—";
                        $("._msg").textContent = "no active iface";
                    }
                } catch (e) { if (alive) $("._msg").textContent = "error"; } finally { busy = false; }
            };
            tick();
            const iv = setInterval(tick, 15000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
