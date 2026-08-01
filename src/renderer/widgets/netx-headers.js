"use strict";
window.I18N.register({
    en: { "widget.netx_headers": "HTTP Headers", "cat.network": "Network" },
    ru: { "widget.netx_headers": "HTTP заголовки", "cat.network": "Сеть" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.netx_headers = {
        id: "netx_headers",
        title: "widget.netx_headers",
        category: "network",
        description: "Fetch and show HTTP response headers for a URL",
        defaultSize: { w: 12, h: 4 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🧾 HEADERS</span>
                    <input class="_url" placeholder="https://example.com" style="flex:1;min-width:0" />
                    <button class="_go" style="flex:none">Fetch</button>
                    <span class="_msg" style="color:var(--text-dim)"></span>
                  </div>
                  <div class="_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:8px">
                    <div style="color:var(--text-dim)">Enter a URL and fetch its response headers (follows redirects).</div>
                  </div>
                </div>`;
            const $ = s => body.querySelector(s);
            $("._url").style.cssText += ";background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono)";
            $("._go").style.cssText += ";background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:5px 12px;cursor:pointer";

            let alive = true, busy = false;

            const normalize = (u) => { u = u.trim(); if (!u) return u; if (!/^https?:\/\//i.test(u)) u = "https://" + u; return u; };

            const renderBlocks = (raw) => {
                // curl -D - dumps header blocks separated by blank lines (one per redirect hop)
                const blocks = raw.split(/\r?\n\r?\n/).map(b => b.trim()).filter(Boolean);
                if (!blocks.length) { $("._body").innerHTML = `<div style="color:var(--text-dim)">No headers returned.</div>`; return; }
                let html = "";
                blocks.forEach((b, i) => {
                    const lines = b.split(/\r?\n/);
                    const statusLine = lines[0] || "";
                    const code = (statusLine.match(/\s(\d{3})\s/) || [])[1] || "";
                    const col = /^2/.test(code) ? "var(--accent2)" : /^3/.test(code) ? "var(--accent)" : /^[45]/.test(code) ? "var(--danger)" : "var(--text)";
                    html += `<div style="margin:${i ? '12px' : '0'} 0 4px;color:${col};font-family:var(--font-mono);font-weight:600">${esc(statusLine)}</div>`;
                    html += `<table style="border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px"><tbody>`;
                    lines.slice(1).forEach(l => {
                        const idx = l.indexOf(":");
                        if (idx < 0) return;
                        const k = l.slice(0, idx).trim(), v = l.slice(idx + 1).trim();
                        html += `<tr><td style="padding:2px 14px 2px 0;color:var(--text-dim);vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:2px 0;color:var(--text);word-break:break-all">${esc(v)}</td></tr>`;
                    });
                    html += `</tbody></table>`;
                });
                $("._body").innerHTML = html;
            };

            const run = async () => {
                if (busy) return;
                const url = normalize($("._url").value);
                if (!url) { $("._msg").textContent = "enter URL"; return; }
                busy = true; $("._msg").textContent = "…"; $("._go").disabled = true;
                try {
                    const r = await window.dyo.exec("curl", ["-sS", "-L", "-D", "-", "-o", "/dev/null", "--max-time", "12", url], { timeout: 16000 });
                    if (!alive) return;
                    if (!r || (r.code !== 0 && !r.stdout)) {
                        const err = (r && r.stderr || "").trim();
                        let msg = err || "request failed";
                        if (r && r.code === 127) msg = "curl not found";
                        $("._body").innerHTML = `<div style="color:var(--danger);padding:4px">${esc(msg)}</div>`;
                        $("._msg").textContent = ""; return;
                    }
                    $("._msg").textContent = "";
                    renderBlocks(r.stdout || "");
                } catch (e) {
                    if (alive) $("._body").innerHTML = `<div style="color:var(--danger)">Error fetching headers.</div>`;
                } finally { busy = false; if (alive) $("._go").disabled = false; }
            };

            $("._go").addEventListener("click", run);
            $("._url").addEventListener("keydown", e => { if (e.key === "Enter") run(); });

            return { destroy: () => { alive = false; } };
        }
    };
})();
