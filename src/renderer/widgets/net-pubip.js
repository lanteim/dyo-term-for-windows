"use strict";
window.I18N.register({
    en: { "widget.pubip": "Public IP", "cat.network": "Network" },
    ru: { "widget.pubip": "Внешний IP", "cat.network": "Сеть" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.pubip = {
    id: "pubip",
    title: "widget.pubip",
    category: "network",
    description: "External IP address with geo/ISP info",
    defaultSize: { w: 6, h: 2 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div class="metric-row"><span class="k">PUBLIC IP</span><span class="v"><b class="_pi_ip" style="font-family:var(--font-mono);cursor:pointer" title="Click to copy">…</b></span></div>
              <div class="metric-row"><span class="k">LOCATION</span><span class="v _pi_loc">—</span></div>
              <div class="metric-row"><span class="k">ISP</span><span class="v _pi_isp" style="max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">—</span></div>
              <div style="display:flex;align-items:center;gap:8px;margin-top:auto">
                <button class="_pi_go" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 10px;cursor:pointer;font-size:11px">Refresh</button>
                <span class="_pi_meta" style="color:var(--text-dim);font-size:11px"></span>
              </div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;

        $("._pi_ip").onclick = () => {
            const ip = $("._pi_ip").textContent.trim();
            if (ip && ip !== "…") navigator.clipboard.writeText(ip).catch(() => {});
        };

        const load = async () => {
            if (busy) return;
            busy = true;
            $("._pi_meta").textContent = "fetching…";
            try {
                const r = await window.dyo.http("https://api.ipify.org?format=json", { timeout: 8000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("._pi_ip").textContent = "—";
                    $("._pi_meta").textContent = "";
                    $("._pi_loc").innerHTML = `<span style="color:var(--danger)">${esc((r && r.error) || "lookup failed")}</span>`;
                    busy = false; return;
                }
                let ip = "";
                try { ip = JSON.parse(r.text).ip || ""; } catch (e) { ip = (r.text || "").trim(); }
                $("._pi_ip").textContent = ip || "—";
                $("._pi_meta").textContent = "";
                if (!ip) { busy = false; return; }
                // geo lookup (best effort)
                const g = await window.dyo.http("http://ip-api.com/json/" + encodeURIComponent(ip), { timeout: 8000 });
                if (!alive) return;
                if (g && g.ok && !g.error) {
                    try {
                        const j = JSON.parse(g.text);
                        if (j.status === "success") {
                            const loc = [j.city, j.regionName, j.country].filter(Boolean).join(", ");
                            $("._pi_loc").textContent = loc || "—";
                            $("._pi_isp").textContent = j.isp || j.org || "—";
                            $("._pi_isp").title = j.isp || j.org || "";
                        }
                    } catch (e) { /* leave defaults */ }
                }
            } catch (e) {
                if (alive) { $("._pi_meta").textContent = ""; $("._pi_loc").innerHTML = `<span style="color:var(--danger)">Error: ${esc(e && e.message)}</span>`; }
            } finally { busy = false; }
        };
        $("._pi_go").onclick = load;
        load();

        return { destroy: () => { alive = false; } };
    }
};
