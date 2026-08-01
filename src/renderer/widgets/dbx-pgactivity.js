"use strict";
window.I18N.register({
    en: { "widget.dbx_pgactivity": "PG Activity", "cat.db": "Databases" },
    ru: { "widget.dbx_pgactivity": "PG Активность", "cat.db": "Базы данных" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.dbx_pgactivity = {
    id: "dbx_pgactivity",
    title: "widget.dbx_pgactivity",
    category: "db",
    description: "Live pg_stat_activity monitor",
    defaultSize: { w: 12, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const SKEY = "dbx_pgactivity";
        const TYPE = "postgres";
        let connId = null, timer = null, alive = true, busy = false;

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
              <div class="_c" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
                <span style="color:var(--accent);font-weight:600">postgres</span>
                <input class="_h" placeholder="host" value="127.0.0.1" style="width:110px"/>
                <input class="_p" placeholder="5432" style="width:60px"/>
                <input class="_u" placeholder="user" style="width:90px"/>
                <input class="_pw" placeholder="password" type="password" style="width:100px"/>
                <input class="_d" placeholder="database" style="width:100px"/>
                <button class="_go">Connect</button>
                <span class="_st" style="color:var(--text-dim);margin-left:auto"></span>
              </div>
              <div class="_sum" style="display:flex;gap:14px;color:var(--text-dim)"></div>
              <div class="_r" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        ["._h", "._p", "._u", "._pw", "._d"].forEach(s => { $(s).style.cssText += ";background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono)"; });
        $("._go").style.cssText += ";background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 10px;cursor:pointer";

        (async () => {
            const st = await window.dyo.settings.get();
            if (!alive || !st || !st[SKEY]) return;
            const c = st[SKEY];
            if (c.host) $("._h").value = c.host;
            if (c.port) $("._p").value = c.port;
            if (c.user) $("._u").value = c.user;
            if (c.database) $("._d").value = c.database;
        })();

        const status = (t, bad) => { const el = $("._st"); if (!el) return; el.textContent = t; el.style.color = bad ? "var(--danger)" : "var(--accent2)"; };

        const tick = async () => {
            if (busy || !connId || !alive) return;
            busy = true;
            const r = await window.dyo.db.query(connId, "SELECT pid, usename, state, wait_event_type, query FROM pg_stat_activity WHERE pid <> pg_backend_pid() ORDER BY state NULLS LAST, pid");
            busy = false;
            if (!alive || !connId) return;
            if (r.error) { $("._r").innerHTML = `<div style="padding:10px;color:var(--danger)">${esc(r.error)}</div>`; return; }
            const rows = r.rows || [];
            let active = 0, iit = 0, idle = 0;
            rows.forEach(x => { const s = (x.state || ""); if (s === "active") active++; else if (s === "idle in transaction") iit++; else if (s === "idle") idle++; });
            $("._sum").innerHTML = `<span>total <b style="color:var(--text)">${rows.length}</b></span>`
                + `<span>active <b style="color:var(--accent2)">${active}</b></span>`
                + `<span>idle-in-txn <b style="color:${iit ? 'var(--danger)' : 'var(--text)'}">${iit}</b></span>`
                + `<span>idle <b style="color:var(--text)">${idle}</b></span>`;
            let h = `<table style="border-collapse:collapse;width:100%;font-family:var(--font-mono);font-size:11.5px"><thead><tr>`;
            ["pid", "usename", "state", "wait", "query"].forEach(c => h += `<th style="position:sticky;top:0;background:var(--bg-elevated);text-align:left;padding:5px 8px;border-bottom:1px solid var(--border);color:var(--accent)">${c}</th>`);
            h += `</tr></thead><tbody>`;
            rows.slice(0, 200).forEach(x => {
                const col = x.state === "active" ? "var(--accent2)" : x.state === "idle in transaction" ? "var(--danger)" : "var(--text-dim)";
                h += `<tr><td style="padding:4px 8px;border-bottom:1px solid var(--border)">${esc(x.pid)}</td>`
                    + `<td style="padding:4px 8px;border-bottom:1px solid var(--border)">${esc(x.usename)}</td>`
                    + `<td style="padding:4px 8px;border-bottom:1px solid var(--border);color:${col}">${esc(x.state)}</td>`
                    + `<td style="padding:4px 8px;border-bottom:1px solid var(--border);color:var(--text-dim)">${esc(x.wait_event_type)}</td>`
                    + `<td style="padding:4px 8px;border-bottom:1px solid var(--border);max-width:520px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.query)}</td></tr>`;
            });
            h += `</tbody></table>`;
            $("._r").innerHTML = h;
        };

        $("._go").onclick = async () => {
            if (connId) { const id = connId; connId = null; if (timer) clearInterval(timer); timer = null; await window.dyo.db.close(id); $("._go").textContent = "Connect"; status("disconnected"); $("._st").style.color = "var(--text-dim)"; return; }
            status("connecting…"); $("._st").style.color = "var(--text-dim)";
            const cfg = { type: TYPE, host: $("._h").value.trim(), port: Number($("._p").value) || 5432, user: $("._u").value.trim(), password: $("._pw").value, database: $("._d").value.trim() };
            const res = await window.dyo.db.connect(cfg);
            if (!alive) { if (res && res.id) window.dyo.db.close(res.id); return; }
            if (res.error) { status("✕ " + res.error, true); return; }
            connId = res.id;
            status("● " + String(res.version || TYPE).split(/[,(]/)[0].trim());
            const patch = {}; patch[SKEY] = { host: cfg.host, port: cfg.port, user: cfg.user, database: cfg.database };
            window.dyo.settings.set(patch);
            $("._go").textContent = "Disconnect";
            tick();
            timer = setInterval(tick, 4000);
        };

        return { destroy: () => { alive = false; if (timer) clearInterval(timer); if (connId) window.dyo.db.close(connId); } };
    }
};
