"use strict";
window.I18N.register({
    en: { "widget.dbx_pglocks": "PG Locks", "cat.db": "Databases" },
    ru: { "widget.dbx_pglocks": "PG Блокировки", "cat.db": "Базы данных" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.dbx_pglocks = {
    id: "dbx_pglocks",
    title: "widget.dbx_pglocks",
    category: "db",
    description: "Blocked / blocking queries via pg_locks",
    defaultSize: { w: 12, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const SKEY = "dbx_pglocks";
        const TYPE = "postgres";
        let connId = null, timer = null, alive = true, busy = false;

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
              <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
                <span style="color:var(--accent);font-weight:600">postgres</span>
                <input class="_h" placeholder="host" value="127.0.0.1" style="width:110px"/>
                <input class="_p" placeholder="5432" style="width:60px"/>
                <input class="_u" placeholder="user" style="width:90px"/>
                <input class="_pw" placeholder="password" type="password" style="width:100px"/>
                <input class="_d" placeholder="database" style="width:100px"/>
                <button class="_go">Connect</button>
                <span class="_st" style="color:var(--text-dim);margin-left:auto"></span>
              </div>
              <div class="_sum" style="color:var(--text-dim)"></div>
              <div class="_r" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        ["._h", "._p", "._u", "._pw", "._d"].forEach(s => { $(s).style.cssText += ";background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono)"; });
        $("._go").style.cssText += ";background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 10px;cursor:pointer";
        $("._r").innerHTML = `<div style="padding:10px;color:var(--text-dim)">Not connected — enter connection details and press Connect.</div>`;

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
        const SQL = "SELECT a.pid AS blocked_pid, a.usename AS blocked_user, a.query AS blocked_query, pg_blocking_pids(a.pid) AS blocking_pids, b.query AS blocking_query FROM pg_stat_activity a LEFT JOIN LATERAL (SELECT string_agg(query, ' | ') AS query FROM pg_stat_activity WHERE pid = ANY(pg_blocking_pids(a.pid))) b ON true WHERE cardinality(pg_blocking_pids(a.pid)) > 0 ORDER BY a.pid";

        const tick = async () => {
            if (busy || !connId || !alive) return;
            busy = true;
            const r = await window.dyo.db.query(connId, SQL);
            busy = false;
            if (!alive || !connId) return;
            if (!r || r.error) { $("._r").innerHTML = `<div style="padding:10px;color:var(--danger)">${esc((r && r.error) || "query failed")}</div>`; return; }
            const rows = r.rows || [];
            $("._sum").innerHTML = rows.length
                ? `<span style="color:var(--danger)">● ${rows.length} blocked ${rows.length === 1 ? "query" : "queries"}</span>`
                : `<span style="color:var(--accent2)">● no blocked queries</span>`;
            if (!rows.length) { $("._r").innerHTML = `<div style="padding:12px;color:var(--text-dim)">No lock contention detected.</div>`; return; }
            let h = `<table style="border-collapse:collapse;width:100%;font-family:var(--font-mono);font-size:11.5px"><thead><tr>`;
            ["blocked_pid", "blocked_user", "blocking_pids", "blocked_query", "blocking_query"].forEach(c => h += `<th style="position:sticky;top:0;background:var(--bg-elevated);text-align:left;padding:5px 8px;border-bottom:1px solid var(--border);color:var(--accent)">${c}</th>`);
            h += `</tr></thead><tbody>`;
            rows.slice(0, 200).forEach(x => {
                let bp = x.blocking_pids; if (bp && typeof bp === "object") bp = JSON.stringify(bp);
                h += `<tr><td style="padding:4px 8px;border-bottom:1px solid var(--border);color:var(--danger)">${esc(x.blocked_pid)}</td>`
                    + `<td style="padding:4px 8px;border-bottom:1px solid var(--border)">${esc(x.blocked_user)}</td>`
                    + `<td style="padding:4px 8px;border-bottom:1px solid var(--border);color:var(--accent2)">${esc(bp)}</td>`
                    + `<td style="padding:4px 8px;border-bottom:1px solid var(--border);max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.blocked_query)}</td>`
                    + `<td style="padding:4px 8px;border-bottom:1px solid var(--border);max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.blocking_query)}</td></tr>`;
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
            if (!res || res.error) { status("✕ " + ((res && res.error) || "connection failed"), true); return; }
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
