"use strict";
window.I18N.register({
    en: { "widget.netx_portscan": "Port Scan", "cat.network": "Network" },
    ru: { "widget.netx_portscan": "Скан портов", "cat.network": "Сеть" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
    const CAP = 200;

    window.WIDGETS.netx_portscan = {
        id: "netx_portscan",
        title: "widget.netx_portscan",
        category: "network",
        description: "TCP port scan a host over a range (nc/nmap)",
        defaultSize: { w: 12, h: 4 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span style="color:var(--text-dim)">🔎 PORTS</span>
                    <input class="_host" placeholder="host (e.g. scanme.nmap.org)" style="flex:1;min-width:140px" />
                    <input class="_range" placeholder="20-1000" value="20-1000" style="width:100px" />
                    <button class="_go" style="flex:none">Scan</button>
                    <button class="_stop" style="flex:none;display:none">Stop</button>
                    <span class="_msg" style="color:var(--text-dim);margin-left:auto"></span>
                  </div>
                  <div class="_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:6px">
                    <div style="color:var(--text-dim)">Enter a host and port range. Scans up to ${CAP} ports; large ranges can be slow.</div>
                  </div>
                </div>`;
            const $ = s => body.querySelector(s);
            ["._host", "._range"].forEach(s => { $(s).style.cssText += ";background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono)"; });
            $("._go").style.cssText += ";background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:5px 12px;cursor:pointer";
            $("._stop").style.cssText += ";background:transparent;color:var(--danger);border:1px solid var(--border);border-radius:6px;padding:5px 12px;cursor:pointer";

            let alive = true, running = false, cancel = false, haveNmap = null;

            const detectNmap = async () => {
                if (haveNmap !== null) return haveNmap;
                try { const r = await window.dyo.exec("nmap", ["--version"], { timeout: 4000 }); haveNmap = !!(r && r.code === 0); } catch (e) { haveNmap = false; }
                return haveNmap;
            };

            const parseRange = (s) => {
                s = String(s || "").trim();
                let a, b;
                const m = s.match(/^(\d+)\s*-\s*(\d+)$/);
                if (m) { a = +m[1]; b = +m[2]; }
                else if (/^\d+$/.test(s)) { a = b = +s; }
                else return null;
                if (a < 1 || b > 65535 || a > b) return null;
                return [a, b];
            };

            const scanNmap = async (host, a, b) => {
                $("._msg").textContent = "nmap scanning…";
                const r = await window.dyo.exec("nmap", ["-p", a + "-" + b, "-T4", "--open", host], { timeout: 120000 });
                if (!alive || cancel) return;
                if (!r || r.code !== 0) { $("._body").innerHTML = `<div style="color:var(--danger);padding:8px">nmap failed: ${esc((r && r.stderr) || "error")}</div>`; return; }
                const open = [];
                (r.stdout || "").split("\n").forEach(l => {
                    const m = l.match(/^(\d+)\/tcp\s+open\s+(\S+)?/);
                    if (m) open.push({ port: +m[1], svc: m[2] || "" });
                });
                renderOpen(host, open, b - a + 1);
            };

            const scanNc = async (host, a, b) => {
                const total = b - a + 1;
                const open = [];
                let done = 0;
                for (let p = a; p <= b; p++) {
                    if (!alive || cancel) break;
                    try {
                        const r = await window.dyo.exec("nc", ["-z", "-G1", "-w1", host, String(p)], { timeout: 3000 });
                        if (r && r.code === 0) open.push({ port: p, svc: "" });
                    } catch (e) { /* ignore per-port */ }
                    done++;
                    if (done % 10 === 0 || p === b) { $("._msg").textContent = `${done}/${total} · ${open.length} open`; }
                }
                if (!alive) return;
                renderOpen(host, open, total, cancel);
            };

            const renderOpen = (host, open, scanned, stopped) => {
                open.sort((x, y) => x.port - y.port);
                let h = `<div style="color:var(--text-dim);margin-bottom:6px">${esc(host)} · scanned ${scanned}${stopped ? " (stopped)" : ""} · <b style="color:var(--accent2)">${open.length} open</b></div>`;
                if (!open.length) { h += `<div style="color:var(--text-dim)">No open ports found in range.</div>`; }
                else {
                    h += `<table style="border-collapse:collapse;font-family:var(--font-mono);font-size:12px"><thead><tr><th style="text-align:left;padding:4px 12px 4px 4px;color:var(--accent)">PORT</th><th style="text-align:left;padding:4px;color:var(--accent)">SERVICE</th></tr></thead><tbody>`;
                    open.slice(0, CAP).forEach(o => { h += `<tr><td style="padding:3px 12px 3px 4px;color:var(--accent2)">${esc(o.port)}</td><td style="padding:3px 4px;color:var(--text-dim)">${esc(o.svc)}</td></tr>`; });
                    h += `</tbody></table>`;
                }
                $("._body").innerHTML = h;
            };

            const run = async () => {
                if (running) return;
                const host = $("._host").value.trim();
                const rng = parseRange($("._range").value);
                if (!host) { $("._msg").textContent = "enter host"; return; }
                if (!rng) { $("._msg").textContent = "bad range"; return; }
                let [a, b] = rng;
                let capped = false;
                if (b - a + 1 > CAP) { b = a + CAP - 1; capped = true; }
                running = true; cancel = false;
                $("._go").style.display = "none"; $("._stop").style.display = "";
                $("._body").innerHTML = `<div style="color:var(--text-dim)">Scanning ${esc(host)} ports ${a}-${b}${capped ? " (capped to " + CAP + ")" : ""}…</div>`;
                try {
                    if (await detectNmap()) await scanNmap(host, a, b);
                    else await scanNc(host, a, b);
                } catch (e) {
                    if (alive) $("._body").innerHTML = `<div style="color:var(--danger);padding:8px">Scan error. Ensure nc or nmap is installed.</div>`;
                } finally {
                    running = false;
                    if (alive) { $("._go").style.display = ""; $("._stop").style.display = "none"; $("._msg").textContent = ""; }
                }
            };

            $("._go").addEventListener("click", run);
            $("._stop").addEventListener("click", () => { cancel = true; $("._msg").textContent = "stopping…"; });
            $("._host").addEventListener("keydown", e => { if (e.key === "Enter") run(); });
            $("._range").addEventListener("keydown", e => { if (e.key === "Enter") run(); });

            return { destroy: () => { alive = false; cancel = true; } };
        }
    };
})();
