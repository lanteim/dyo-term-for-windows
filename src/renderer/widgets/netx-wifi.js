"use strict";
window.I18N.register({
    en: { "widget.netx_wifi": "Wi-Fi", "cat.network": "Network" },
    ru: { "widget.netx_wifi": "Wi-Fi", "cat.network": "Сеть" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
    const AIRPORT = "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport";

    window.WIDGETS.netx_wifi = {
        id: "netx_wifi",
        title: "widget.netx_wifi",
        category: "network",
        description: "Current Wi-Fi SSID, signal, rate",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">📶 WI-FI</span>
                    <b class="_ssid" style="color:var(--accent)">—</b>
                    <span class="_msg" style="color:var(--text-dim);margin-left:auto"></span>
                  </div>
                  <div class="_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:8px"></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false, iv = null;

            const rssiToPct = (rssi) => {
                if (rssi == null) return 0;
                // -30 great .. -90 poor
                return Math.max(0, Math.min(100, Math.round(2 * (rssi + 100))));
            };

            const renderInfo = (info) => {
                $("._ssid").textContent = info.ssid || "not associated";
                const rows = [];
                if (info.rssi != null) {
                    const pct = rssiToPct(info.rssi);
                    const col = pct > 60 ? "var(--accent2)" : pct > 30 ? "var(--accent)" : "var(--danger)";
                    rows.push(`<div class="metric-row"><span class="k" style="color:var(--text-dim)">signal</span><span class="v" style="font-variant-numeric:tabular-nums">${esc(info.rssi)} dBm (${pct}%)</span></div>
                        <div class="bar" style="height:8px;background:var(--bg-elevated);border-radius:4px;overflow:hidden;margin:2px 0 6px"><i style="display:block;height:100%;width:${pct}%;background:${col}"></i></div>`);
                }
                if (info.noise != null) rows.push(`<div class="metric-row"><span class="k" style="color:var(--text-dim)">noise</span><span class="v">${esc(info.noise)} dBm</span></div>`);
                if (info.rate != null) rows.push(`<div class="metric-row"><span class="k" style="color:var(--text-dim)">tx rate</span><span class="v">${esc(info.rate)} Mbps</span></div>`);
                if (info.channel) rows.push(`<div class="metric-row"><span class="k" style="color:var(--text-dim)">channel</span><span class="v">${esc(info.channel)}</span></div>`);
                if (info.bssid) rows.push(`<div class="metric-row"><span class="k" style="color:var(--text-dim)">bssid</span><span class="v" style="font-family:var(--font-mono)">${esc(info.bssid)}</span></div>`);
                $("._body").innerHTML = rows.length ? rows.join("") : `<div style="color:var(--text-dim)">Wi-Fi appears off or not associated.</div>`;
            };

            const parseAirport = (out) => {
                const g = (re) => { const m = out.match(re); return m ? m[1].trim() : null; };
                const ssid = g(/\bSSID:\s*(.+)/);
                const rssi = g(/\bagrCtlRSSI:\s*(-?\d+)/);
                const noise = g(/\bagrCtlNoise:\s*(-?\d+)/);
                const rate = g(/\blastTxRate:\s*(\d+)/);
                const channel = g(/\bchannel:\s*(.+)/);
                const bssid = g(/\bBSSID:\s*(.+)/);
                if (ssid == null && rssi == null) return null;
                return { ssid, rssi: rssi != null ? +rssi : null, noise: noise != null ? +noise : null, rate: rate != null ? +rate : null, channel, bssid };
            };

            const parseSP = (out) => {
                // system_profiler SPAirPortDataType — find "Current Network Information:" block
                const idx = out.indexOf("Current Network Information:");
                if (idx < 0) return null;
                const seg = out.slice(idx, idx + 800);
                const g = (re) => { const m = seg.match(re); return m ? m[1].trim() : null; };
                const ssidLine = seg.match(/Current Network Information:\s*\n\s*([^\n]+):/);
                const ssid = ssidLine ? ssidLine[1].trim() : null;
                const rssi = g(/Signal\s*\/\s*Noise:\s*(-?\d+)\s*dBm/);
                const rate = g(/Transmit Rate:\s*(\d+)/);
                const channel = g(/Channel:\s*(.+)/);
                if (!ssid && rssi == null) return null;
                return { ssid, rssi: rssi != null ? +rssi : null, noise: null, rate: rate != null ? +rate : null, channel, bssid: null };
            };

            const degrade = (msg) => {
                $("._ssid").textContent = "—"; $("._msg").textContent = "";
                $("._body").innerHTML = `<div style="color:var(--text-dim);line-height:1.5">${esc(msg)}</div>`;
            };

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    let r = await window.dyo.exec(AIRPORT, ["-I"], { timeout: 6000 });
                    let info = null;
                    const out = r ? ((r.stdout || "") + (r.stderr || "")) : "";
                    if (r && r.code === 0 && !/no longer supported|not supported/i.test(out)) info = parseAirport(r.stdout || "");
                    if (!info) {
                        // fallback: system_profiler
                        const sp = await window.dyo.exec("system_profiler", ["SPAirPortDataType"], { timeout: 12000 });
                        if (!alive) return;
                        if (sp && sp.code === 0) info = parseSP(sp.stdout || "");
                    }
                    if (!alive) return;
                    if (!info) { degrade("Wi-Fi info unavailable. The legacy 'airport' tool is deprecated on recent macOS and system_profiler returned nothing. Ensure Wi-Fi is on."); return; }
                    $("._msg").textContent = "";
                    renderInfo(info);
                } catch (e) { degrade("Error reading Wi-Fi status."); } finally { busy = false; }
            };
            tick();
            iv = setInterval(tick, 5000);
            return { destroy: () => { alive = false; if (iv) clearInterval(iv); } };
        }
    };
})();
