"use strict";
window.I18N.register({
    en: { "widget.dbx_tablebrowser": "Table Browser", "cat.db": "Databases" },
    ru: { "widget.dbx_tablebrowser": "Обзор таблиц", "cat.db": "Базы данных" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.dbx_tablebrowser = {
    id: "dbx_tablebrowser",
    title: "widget.dbx_tablebrowser",
    category: "db",
    description: "Browse tables and preview rows (pg/mysql/clickhouse)",
    defaultSize: { w: 12, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const SKEY = "dbx_tablebrowser";
        const PORTS = { postgres: "5432", mysql: "3306", clickhouse: "8123" };
        let connId = null, timer = null, alive = true, busy = false;
        let curType = "postgres", selected = null, tables = [];

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
              <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
                <select class="_t" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px">
                  <option value="postgres">Postgres</option>
                  <option value="mysql">MySQL</option>
                  <option value="clickhouse">ClickHouse</option>
                </select>
                <input class="_h" placeholder="host" value="127.0.0.1" style="width:100px"/>
                <input class="_p" placeholder="5432" style="width:56px"/>
                <input class="_u" placeholder="user" style="width:80px"/>
                <input class="_pw" placeholder="password" type="password" style="width:96px"/>
                <input class="_d" placeholder="database" style="width:96px"/>
                <button class="_go">Connect</button>
                <span class="_st" style="color:var(--text-dim);margin-left:auto"></span>
              </div>
              <div style="flex:1;display:flex;gap:8px;min-height:0">
                <div class="_list" style="width:190px;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:4px"></div>
                <div class="_r" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px"></div>
              </div>
              <div class="_meta" style="color:var(--text-dim)"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        ["._h", "._p", "._u", "._pw", "._d"].forEach(s => { $(s).style.cssText += ";background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono)"; });
        $("._go").style.cssText += ";background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 10px;cursor:pointer";
        $("._list").innerHTML = `<div style="color:var(--text-dim);padding:6px">Not connected.</div>`;
        $("._r").innerHTML = `<div style="padding:10px;color:var(--text-dim)">Connect, then pick a table.</div>`;

        $("._t").onchange = () => { $("._p").placeholder = PORTS[$("._t").value] || ""; };

        (async () => {
            const st = await window.dyo.settings.get();
            if (!alive || !st || !st[SKEY]) { $("._t").onchange(); return; }
            const c = st[SKEY];
            if (c.type && PORTS[c.type]) $("._t").value = c.type;
            if (c.host) $("._h").value = c.host;
            if (c.port) $("._p").value = c.port;
            if (c.user) $("._u").value = c.user;
            if (c.database) $("._d").value = c.database;
            $("._t").onchange();
        })();

        const status = (t, bad) => { const el = $("._st"); if (!el) return; el.textContent = t; el.style.color = bad ? "var(--danger)" : "var(--accent2)"; };
        const tableName = row => row.tablename != null ? row.tablename : row.name != null ? row.name : (row && typeof row === "object" ? Object.values(row)[0] : row);
        const listSql = t => t === "postgres" ? "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename" : "SHOW TABLES";
        const quote = (t, name) => {
            const n = String(name);
            if (t === "postgres") return '"public"."' + n.replace(/"/g, '""') + '"';
            return '`' + n.replace(/`/g, '``') + '`';
        };

        const renderList = () => {
            const el = $("._list");
            el.innerHTML = "";
            if (!tables.length) { el.innerHTML = `<div style="color:var(--text-dim);padding:6px">No tables.</div>`; return; }
            tables.forEach(name => {
                const row = document.createElement("div");
                row.textContent = name;
                row.title = name;
                row.style.cssText = "padding:4px 8px;border-radius:5px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--font-mono);" + (name === selected ? "background:var(--bg-elevated);color:var(--accent);" : "color:var(--text);");
                row.onclick = () => { selected = name; renderList(); loadRows(); };
                el.appendChild(row);
            });
        };

        const loadTables = async () => {
            const r = await window.dyo.db.query(connId, listSql(curType));
            if (!alive || !connId) return;
            if (!r || r.error) { $("._list").innerHTML = `<div style="padding:6px;color:var(--danger)">${esc((r && r.error) || "query failed")}</div>`; return; }
            tables = (r.rows || []).map(tableName).filter(x => x != null).map(String);
            if (selected && tables.indexOf(selected) === -1) selected = null;
            renderList();
        };

        const loadRows = async () => {
            if (!selected || !connId) return;
            const r = await window.dyo.db.query(connId, "SELECT * FROM " + quote(curType, selected) + " LIMIT 100");
            if (!alive || !connId) return;
            if (!r || r.error) { $("._r").innerHTML = `<div style="padding:10px;color:var(--danger)">${esc((r && r.error) || "query failed")}</div>`; $("._meta").textContent = ""; return; }
            const cols = r.columns || (r.rows && r.rows[0] ? Object.keys(r.rows[0]) : []);
            const rows = r.rows || [];
            $("._meta").textContent = `${esc(selected)} · ${rows.length} rows` + (r.elapsedMs != null ? ` · ${r.elapsedMs} ms` : "");
            let h = `<table style="border-collapse:collapse;width:100%;font-family:var(--font-mono);font-size:11.5px"><thead><tr>`;
            cols.forEach(c => h += `<th style="position:sticky;top:0;background:var(--bg-elevated);text-align:left;padding:5px 8px;border-bottom:1px solid var(--border);color:var(--accent)">${esc(c)}</th>`);
            h += `</tr></thead><tbody>`;
            rows.forEach(row => {
                h += `<tr>`;
                cols.forEach(c => { let v = row[c]; if (v && typeof v === "object") v = JSON.stringify(v); h += `<td style="padding:4px 8px;border-bottom:1px solid var(--border);white-space:nowrap;max-width:320px;overflow:hidden;text-overflow:ellipsis">${esc(v)}</td>`; });
                h += `</tr>`;
            });
            h += `</tbody></table>`;
            if (!cols.length) h = `<div style="padding:10px;color:var(--text-dim)">Empty table.</div>`;
            $("._r").innerHTML = h;
        };

        const tick = async () => {
            if (busy || !connId || !alive) return;
            busy = true;
            try { if (selected) await loadRows(); else await loadTables(); }
            finally { busy = false; }
        };

        $("._go").onclick = async () => {
            if (connId) { const id = connId; connId = null; if (timer) clearInterval(timer); timer = null; await window.dyo.db.close(id); $("._go").textContent = "Connect"; status("disconnected"); $("._st").style.color = "var(--text-dim)"; $("._list").innerHTML = `<div style="color:var(--text-dim);padding:6px">Not connected.</div>`; return; }
            status("connecting…"); $("._st").style.color = "var(--text-dim)";
            curType = $("._t").value;
            const cfg = { type: curType, host: $("._h").value.trim(), port: Number($("._p").value) || Number(PORTS[curType]), user: $("._u").value.trim(), password: $("._pw").value, database: $("._d").value.trim() };
            const res = await window.dyo.db.connect(cfg);
            if (!alive) { if (res && res.id) window.dyo.db.close(res.id); return; }
            if (!res || res.error) { status("✕ " + ((res && res.error) || "connection failed"), true); return; }
            connId = res.id;
            selected = null; tables = [];
            status("● " + String(res.version || curType).split(/[,(]/)[0].trim());
            const patch = {}; patch[SKEY] = { type: curType, host: cfg.host, port: cfg.port, user: cfg.user, database: cfg.database }; window.dyo.settings.set(patch);
            $("._go").textContent = "Disconnect";
            await loadTables();
            timer = setInterval(tick, 4000);
        };

        return { destroy: () => { alive = false; if (timer) clearInterval(timer); if (connId) window.dyo.db.close(connId); } };
    }
};
