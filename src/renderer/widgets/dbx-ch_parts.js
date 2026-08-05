"use strict";
window.I18N.register({
    en: { "widget.dbx_ch_parts": "ClickHouse Parts", "cat.db": "Databases" },
    ru: { "widget.dbx_ch_parts": "ClickHouse Партиции", "cat.db": "Базы данных" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.dbx_ch_parts = {
    id: "dbx_ch_parts",
    title: "widget.dbx_ch_parts",
    category: "db",
    description: "ClickHouse table sizes from system.parts",
    defaultSize: { w: 12, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const SKEY = "dbx_ch_parts";
        const TYPE = "clickhouse";
        let connId = null, timer = null, alive = true, busy = false;

        const fmtBytes = n => { n = Number(n) || 0; const u = ["B", "KB", "MB", "GB", "TB", "PB"]; let i = 0; while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; } return (i === 0 ? n : n.toFixed(1)) + " " + u[i]; };
        const fmtNum = n => (Number(n) || 0).toLocaleString(window.I18N.locale());

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
              <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
                <span style="color:var(--accent);font-weight:600">clickhouse</span>
                <input class="_h" placeholder="host" value="127.0.0.1" style="width:110px"/>
                <input class="_p" placeholder="8123" style="width:60px"/>
                <input class="_u" placeholder="user" value="default" style="width:90px"/>
                <input class="_pw" placeholder="password (opt)" type="password" style="width:110px"/>
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
        const SQL = "SELECT table AS table, sum(rows) AS rows, sum(bytes) AS bytes FROM system.parts WHERE active GROUP BY table ORDER BY sum(bytes) DESC LIMIT 20";
        const pick = (row, key) => row[key] != null ? row[key] : row["sum(" + key + ")"] != null ? row["sum(" + key + ")"] : row[key.toUpperCase()];

        const tick = async () => {
            if (busy || !connId || !alive) return;
            busy = true;
            const r = await window.dyo.db.query(connId, SQL);
            busy = false;
            if (!alive || !connId) return;
            if (!r || r.error) { $("._r").innerHTML = `<div style="padding:10px;color:var(--danger)">${esc((r && r.error) || "query failed")}</div>`; return; }
            const rows = r.rows || [];
            let totBytes = 0, totRows = 0;
            rows.forEach(x => { totBytes += Number(pick(x, "bytes")) || 0; totRows += Number(pick(x, "rows")) || 0; });
            const max = rows.reduce((a, x) => Math.max(a, Number(pick(x, "bytes")) || 0), 0) || 1;
            $("._sum").innerHTML = `<span>tables <b style="color:var(--text)">${rows.length}</b></span>`
                + `<span>rows <b style="color:var(--text)">${fmtNum(totRows)}</b></span>`
                + `<span>size <b style="color:var(--accent2)">${fmtBytes(totBytes)}</b></span>`;
            if (!rows.length) { $("._r").innerHTML = `<div style="padding:12px;color:var(--text-dim)">No active parts (empty or no MergeTree tables).</div>`; return; }
            let h = `<table style="border-collapse:collapse;width:100%;font-family:var(--font-mono);font-size:11.5px"><thead><tr>`;
            ["table", "rows", "bytes", ""].forEach(c => h += `<th style="position:sticky;top:0;background:var(--bg-elevated);text-align:left;padding:5px 8px;border-bottom:1px solid var(--border);color:var(--accent)">${c}</th>`);
            h += `</tr></thead><tbody>`;
            rows.forEach(x => {
                const b = Number(pick(x, "bytes")) || 0;
                const pct = Math.round(b / max * 100);
                h += `<tr><td style="padding:4px 8px;border-bottom:1px solid var(--border);color:var(--accent2)">${esc(pick(x, "table"))}</td>`
                    + `<td style="padding:4px 8px;border-bottom:1px solid var(--border);text-align:right">${fmtNum(pick(x, "rows"))}</td>`
                    + `<td style="padding:4px 8px;border-bottom:1px solid var(--border);text-align:right">${fmtBytes(b)}</td>`
                    + `<td style="padding:4px 8px;border-bottom:1px solid var(--border);width:120px"><div class="bar" style="background:var(--bg-elevated);border-radius:3px;overflow:hidden;height:8px"><i style="display:block;height:100%;width:${pct}%;background:var(--accent)"></i></div></td></tr>`;
            });
            h += `</tbody></table>`;
            $("._r").innerHTML = h;
        };

        $("._go").onclick = async () => {
            if (connId) { const id = connId; connId = null; if (timer) clearInterval(timer); timer = null; await window.dyo.db.close(id); $("._go").textContent = "Connect"; status("disconnected"); $("._st").style.color = "var(--text-dim)"; return; }
            status("connecting…"); $("._st").style.color = "var(--text-dim)";
            const cfg = { type: TYPE, host: $("._h").value.trim(), port: Number($("._p").value) || 8123, user: $("._u").value.trim(), password: $("._pw").value, database: $("._d").value.trim() };
            const res = await window.dyo.db.connect(cfg);
            if (!alive) { if (res && res.id) window.dyo.db.close(res.id); return; }
            if (!res || res.error) { status("✕ " + ((res && res.error) || "connection failed"), true); return; }
            connId = res.id;
            status("● " + String(res.version || TYPE).split(/[,(]/)[0].trim());
            const patch = {}; patch[SKEY] = { host: cfg.host, port: cfg.port, user: cfg.user, database: cfg.database }; window.dyo.settings.set(patch);
            $("._go").textContent = "Disconnect";
            tick();
            timer = setInterval(tick, 4000);
        };

        return { destroy: () => { alive = false; if (timer) clearInterval(timer); if (connId) window.dyo.db.close(connId); } };
    }
};
