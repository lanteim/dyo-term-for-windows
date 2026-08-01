"use strict";
window.I18N.register({
    en: { "widget.netx_speedtest": "Speedtest", "cat.network": "Network" },
    ru: { "widget.netx_speedtest": "Speedtest", "cat.network": "Сеть" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.netx_speedtest = {
        id: "netx_speedtest",
        title: "widget.netx_speedtest",
        category: "network",
        description: "Run an internet speed test (speedtest CLI)",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🚀 SPEEDTEST</span>
                    <button class="_go" style="flex:none">Run</button>
                    <span class="_msg" style="color:var(--text-dim);margin-left:auto"></span>
                  </div>
                  <div class="_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:10px">
                    <div style="color:var(--text-dim)">Click Run to measure download / upload / ping.</div>
                  </div>
                </div>`;
            const $ = s => body.querySelector(s);
            $("._go").style.cssText += ";background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:5px 14px;cursor:pointer";

            let alive = true, busy = false;

            const metric = (label, val, unit, col) => `
                <div style="margin-bottom:10px">
                  <div class="metric-row"><span class="k" style="color:var(--text-dim)">${esc(label)}</span>
                  <span class="v" style="color:${col || 'var(--text)'};font-variant-numeric:tabular-nums;font-weight:600">${esc(val)} <span style="color:var(--text-dim);font-weight:400">${esc(unit)}</span></span></div>
                </div>`;

            const renderResult = (res) => {
                let h = "";
                if (res.server) h += `<div style="color:var(--text-dim);margin-bottom:8px">${esc(res.server)}</div>`;
                if (res.ping != null) h += metric("Ping", res.ping.toFixed(1), "ms", "var(--accent)");
                if (res.download != null) h += metric("Download", res.download.toFixed(2), "Mbps", "var(--accent2)");
                if (res.upload != null) h += metric("Upload", res.upload.toFixed(2), "Mbps", "var(--accent2)");
                $("._body").innerHTML = h || `<div style="color:var(--text-dim)">No result parsed.</div>`;
            };

            // Ookla `speedtest -f json`
            const parseOokla = (out) => {
                try {
                    const j = JSON.parse(out.trim().split("\n").filter(Boolean).pop());
                    if (!j || j.type && j.type !== "result") return null;
                    const dl = j.download && j.download.bandwidth != null ? (j.download.bandwidth * 8 / 1e6) : null;
                    const ul = j.upload && j.upload.bandwidth != null ? (j.upload.bandwidth * 8 / 1e6) : null;
                    const ping = j.ping && j.ping.latency != null ? j.ping.latency : null;
                    if (dl == null && ul == null && ping == null) return null;
                    const server = j.server ? (j.server.name + " · " + (j.server.location || "")) : "";
                    return { download: dl, upload: ul, ping, server };
                } catch (e) { return null; }
            };

            // speedtest-cli --simple
            const parseSimple = (out) => {
                const g = (re) => { const m = out.match(re); return m ? parseFloat(m[1]) : null; };
                const ping = g(/Ping:\s*([\d.]+)\s*ms/i);
                const download = g(/Download:\s*([\d.]+)\s*Mbit\/s/i);
                const upload = g(/Upload:\s*([\d.]+)\s*Mbit\/s/i);
                if (ping == null && download == null && upload == null) return null;
                return { ping, download, upload, server: "" };
            };

            const degrade = () => {
                $("._body").innerHTML = `<div style="color:var(--text-dim);line-height:1.6">
                    No speedtest CLI found. Install one:<br>
                    <span style="font-family:var(--font-mono);color:var(--text)">brew install speedtest-cli</span><br>
                    or the official Ookla CLI:<br>
                    <span style="font-family:var(--font-mono);color:var(--text)">brew install speedtest</span></div>`;
            };

            const run = async () => {
                if (busy) return;
                busy = true; $("._go").disabled = true; $("._msg").textContent = "running…";
                $("._body").innerHTML = `<div style="color:var(--text-dim)">Measuring… this takes ~15-30s.</div>`;
                try {
                    // Try Ookla official first (json)
                    let res = null;
                    let r = await window.dyo.exec("speedtest", ["-f", "json", "--accept-license", "--accept-gdpr"], { timeout: 90000 });
                    if (!alive) return;
                    if (r && r.stdout && r.code === 0) res = parseOokla(r.stdout);
                    if (!res) {
                        r = await window.dyo.exec("speedtest-cli", ["--simple"], { timeout: 90000 });
                        if (!alive) return;
                        if (r && r.stdout && r.code === 0) res = parseSimple(r.stdout);
                    }
                    if (!alive) return;
                    if (res) { $("._msg").textContent = ""; renderResult(res); }
                    else { $("._msg").textContent = ""; degrade(); }
                } catch (e) {
                    if (alive) { $("._msg").textContent = ""; degrade(); }
                } finally { busy = false; if (alive) $("._go").disabled = false; }
            };

            $("._go").addEventListener("click", run);

            return { destroy: () => { alive = false; } };
        }
    };
})();
