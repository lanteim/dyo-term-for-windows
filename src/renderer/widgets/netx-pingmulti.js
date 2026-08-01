"use strict";
window.I18N.register({
    en: { "widget.netx_pingmulti": "Ping Multi", "cat.network": "Network" },
    ru: { "widget.netx_pingmulti": "Пинг (несколько)", "cat.network": "Сеть" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
    const SKEY = "netx_pingmulti";
    const DEFAULTS = ["1.1.1.1", "8.8.8.8", "github.com"];

    window.WIDGETS.netx_pingmulti = {
        id: "netx_pingmulti",
        title: "widget.netx_pingmulti",
        category: "network",
        description: "Ping multiple hosts, show RTT bars",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">📡 PING</span>
                    <input class="_add" placeholder="add host…" style="flex:1;min-width:0" />
                    <button class="_addb" style="flex:none">＋</button>
                    <span class="_msg" style="color:var(--text-dim);margin-left:auto"></span>
                  </div>
                  <div class="_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:4px"></div>
                </div>`;
            const $ = s => body.querySelector(s);
            $("._add").style.cssText += ";background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono)";
            $("._addb").style.cssText += ";background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:5px 10px;cursor:pointer";

            let alive = true, busy = false, hosts = DEFAULTS.slice(), iv = null;

            const save = () => { const p = {}; p[SKEY] = { hosts }; window.dyo.settings.set(p); };
            const clean = h => String(h || "").trim().replace(/\s+/g, "");

            const pingOne = async (h) => {
                try {
                    const r = await window.dyo.exec("ping", ["-c1", "-t2", h], { timeout: 4000 });
                    const out = (r && (r.stdout || "")) + (r && r.stderr || "");
                    const m = out.match(/time[=<]\s*([\d.]+)\s*ms/i);
                    if (m) return { host: h, rtt: parseFloat(m[1]), ok: true };
                    return { host: h, rtt: null, ok: false };
                } catch (e) { return { host: h, rtt: null, ok: false }; }
            };

            const render = (results) => {
                if (!results.length) { $("._body").innerHTML = `<div style="color:var(--text-dim);padding:10px">No hosts. Add one above.</div>`; return; }
                const maxR = Math.max(60, ...results.filter(x => x.rtt != null).map(x => x.rtt));
                const rows = document.createElement("div");
                rows.style.cssText = "display:flex;flex-direction:column;gap:4px";
                results.forEach(r => {
                    const row = document.createElement("div");
                    row.style.cssText = "display:flex;align-items:center;gap:8px;font-family:var(--font-mono);font-size:11.5px";
                    const name = document.createElement("span");
                    name.style.cssText = "width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)";
                    name.textContent = r.host;
                    const barWrap = document.createElement("div");
                    barWrap.style.cssText = "flex:1;height:10px;background:var(--bg-elevated);border-radius:4px;overflow:hidden";
                    const bar = document.createElement("i");
                    const pct = r.rtt != null ? Math.max(4, Math.min(100, (r.rtt / maxR) * 100)) : 0;
                    const col = r.rtt == null ? "var(--danger)" : r.rtt < 40 ? "var(--accent2)" : r.rtt < 120 ? "var(--accent)" : "var(--danger)";
                    bar.style.cssText = `display:block;height:100%;width:${pct}%;background:${col}`;
                    barWrap.appendChild(bar);
                    const val = document.createElement("span");
                    val.style.cssText = "width:64px;text-align:right;font-variant-numeric:tabular-nums;color:" + (r.ok ? "var(--text)" : "var(--danger)");
                    val.textContent = r.ok ? r.rtt.toFixed(1) + " ms" : "timeout";
                    const del = document.createElement("button");
                    del.textContent = "✕"; del.title = "remove";
                    del.style.cssText = "flex:none;background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:5px;padding:1px 6px;cursor:pointer";
                    del.addEventListener("click", () => { hosts = hosts.filter(x => x !== r.host); save(); render(hosts.map(h => ({ host: h, rtt: null, ok: false }))); tick(); });
                    row.appendChild(name); row.appendChild(barWrap); row.appendChild(val); row.appendChild(del);
                    rows.appendChild(row);
                });
                $("._body").innerHTML = ""; $("._body").appendChild(rows);
            };

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    if (!hosts.length) { render([]); return; }
                    $("._msg").textContent = "…";
                    const results = await Promise.all(hosts.map(pingOne));
                    if (!alive) return;
                    $("._msg").textContent = "";
                    render(results);
                } catch (e) { $("._msg").textContent = "error"; } finally { busy = false; }
            };

            const addHost = () => {
                const h = clean($("._add").value);
                if (!h) return;
                if (!hosts.includes(h)) hosts.push(h);
                $("._add").value = ""; save(); tick();
            };
            $("._addb").addEventListener("click", addHost);
            $("._add").addEventListener("keydown", e => { if (e.key === "Enter") addHost(); });

            (async () => {
                const st = await window.dyo.settings.get();
                if (!alive) return;
                if (st && st[SKEY] && Array.isArray(st[SKEY].hosts)) hosts = st[SKEY].hosts.slice();
                render(hosts.map(h => ({ host: h, rtt: null, ok: false })));
                tick();
                iv = setInterval(tick, 5000);
            })();

            return { destroy: () => { alive = false; if (iv) clearInterval(iv); } };
        }
    };
})();
