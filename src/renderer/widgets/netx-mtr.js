"use strict";
window.I18N.register({
    en: { "widget.netx_mtr": "MTR / Traceroute", "cat.network": "Network" },
    ru: { "widget.netx_mtr": "MTR / Traceroute", "cat.network": "Сеть" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.netx_mtr = {
        id: "netx_mtr",
        title: "widget.netx_mtr",
        category: "network",
        description: "Path to a host via mtr (or traceroute)",
        defaultSize: { w: 12, h: 4 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🛰 PATH</span>
                    <input class="_host" placeholder="host (e.g. github.com)" style="flex:1;min-width:0" />
                    <button class="_go" style="flex:none">Trace</button>
                    <span class="_tool" style="color:var(--text-dim)"></span>
                    <span class="_msg" style="color:var(--text-dim)"></span>
                  </div>
                  <div class="_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:8px">
                    <div style="color:var(--text-dim)">Enter a host to trace the network path. Uses mtr if installed, else traceroute.</div>
                  </div>
                </div>`;
            const $ = s => body.querySelector(s);
            $("._host").style.cssText += ";background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono)";
            $("._go").style.cssText += ";background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:5px 12px;cursor:pointer";

            let alive = true, busy = false, haveMtr = null;

            const detectMtr = async () => {
                if (haveMtr !== null) return haveMtr;
                try { const r = await window.dyo.exec("mtr", ["--version"], { timeout: 4000 }); haveMtr = !!(r && r.code === 0); } catch (e) { haveMtr = false; }
                return haveMtr;
            };

            const renderMtr = (out) => {
                const lines = out.split("\n").filter(l => l.trim());
                // header line contains "Loss%"; data lines start with hop number.
                const rows = [];
                lines.forEach(l => {
                    const m = l.match(/^\s*(\d+)\.\|--\s+(\S+)\s+([\d.]+)%\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
                    if (m) rows.push({ hop: m[1], host: m[2], loss: m[3], last: m[5], avg: m[6], best: m[7], worst: m[8] });
                });
                if (!rows.length) { renderRaw(out); return; }
                let h = `<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px"><thead><tr style="text-align:left;color:var(--text-dim)">`;
                ["#", "HOST", "LOSS%", "AVG", "BEST", "WORST"].forEach(c => h += `<th style="padding:4px 8px;position:sticky;top:0;background:var(--bg-elevated)">${c}</th>`);
                h += `</tr></thead><tbody>`;
                rows.forEach(r => {
                    const loss = parseFloat(r.loss) || 0;
                    h += `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:3px 8px;color:var(--text-dim)">${esc(r.hop)}</td>
                        <td style="padding:3px 8px;color:var(--text)">${esc(r.host)}</td>
                        <td style="padding:3px 8px;color:${loss > 0 ? 'var(--danger)' : 'var(--accent2)'}">${esc(r.loss)}</td>
                        <td style="padding:3px 8px;font-variant-numeric:tabular-nums">${esc(r.avg)}</td>
                        <td style="padding:3px 8px;font-variant-numeric:tabular-nums">${esc(r.best)}</td>
                        <td style="padding:3px 8px;font-variant-numeric:tabular-nums">${esc(r.worst)}</td></tr>`;
                });
                h += `</tbody></table>`;
                $("._body").innerHTML = h;
            };

            const renderRaw = (out) => {
                $("._body").innerHTML = `<pre style="margin:0;font-family:var(--font-mono);font-size:11.5px;white-space:pre-wrap;color:var(--text)">${esc(out.trim())}</pre>`;
            };

            const run = async () => {
                if (busy) return;
                const host = $("._host").value.trim();
                if (!host) { $("._msg").textContent = "enter host"; return; }
                busy = true; $("._go").disabled = true; $("._msg").textContent = "tracing…";
                $("._body").innerHTML = `<div style="color:var(--text-dim)">Tracing ${esc(host)}… this can take a while.</div>`;
                try {
                    if (await detectMtr()) {
                        $("._tool").textContent = "mtr";
                        const r = await window.dyo.exec("mtr", ["--report", "--report-cycles", "3", "-c", "3", host], { timeout: 60000 });
                        if (!alive) return;
                        if (!r || (r.code !== 0 && !r.stdout)) { $("._body").innerHTML = `<div style="color:var(--danger)">mtr failed: ${esc((r && r.stderr) || "error")}</div>`; }
                        else renderMtr(r.stdout || "");
                    } else {
                        $("._tool").textContent = "traceroute";
                        const r = await window.dyo.exec("traceroute", ["-w", "2", "-q", "1", host], { timeout: 60000 });
                        if (!alive) return;
                        if (!r || (r.code !== 0 && !r.stdout)) {
                            const msg = (r && r.code === 127) ? "Neither mtr nor traceroute found. Install mtr (brew install mtr)." : ((r && r.stderr) || "traceroute failed");
                            $("._body").innerHTML = `<div style="color:var(--danger)">${esc(msg)}</div>`;
                        } else renderRaw(r.stdout || "");
                    }
                } catch (e) {
                    if (alive) $("._body").innerHTML = `<div style="color:var(--danger)">Trace error. Ensure mtr or traceroute is installed.</div>`;
                } finally { busy = false; if (alive) { $("._go").disabled = false; $("._msg").textContent = ""; } }
            };

            $("._go").addEventListener("click", run);
            $("._host").addEventListener("keydown", e => { if (e.key === "Enter") run(); });

            return { destroy: () => { alive = false; } };
        }
    };
})();
