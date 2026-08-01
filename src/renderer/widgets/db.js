"use strict";
window.WIDGETS = window.WIDGETS || {};

function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}

window.WIDGETS.db = {
    id: "db",
    title: "widget.db",
    category: "db",
    description: "Postgres / MySQL client (mini DataGrip)",
    defaultSize: { w: 12, h: 6 },
    mount(body) {
        let connId = null;
        body.innerHTML = `
            <div class="db-wrap" style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
              <div class="db-conn" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
                <select class="db-type" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px">
                    <option value="postgres">Postgres</option>
                    <option value="mysql">MySQL</option>
                    <option value="clickhouse">ClickHouse</option>
                    <option value="mongodb">MongoDB</option>
                    <option value="redis">Redis</option>
                    <option value="mssql">MSSQL</option>
                </select>
                <input class="db-host" placeholder="host" value="127.0.0.1" style="width:100px"/>
                <input class="db-port" placeholder="port" style="width:60px"/>
                <input class="db-user" placeholder="user" style="width:90px"/>
                <input class="db-pass" placeholder="password" type="password" style="width:100px"/>
                <input class="db-name" placeholder="database" style="width:100px"/>
                <button class="db-connect">Connect</button>
                <span class="db-status" style="color:var(--text-dim);margin-left:auto"></span>
              </div>
              <textarea class="db-sql" spellcheck="false" placeholder="SELECT … — ⌘↵ to run" style="height:64px;resize:vertical;background:var(--terminal-bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px;font-family:var(--font-mono);font-size:12px"></textarea>
              <div style="display:flex;gap:8px;align-items:center">
                <button class="db-run" disabled>Run ⌘↵</button>
                <span class="db-meta" style="color:var(--text-dim)"></span>
              </div>
              <div class="db-result" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        [".db-host", ".db-port", ".db-user", ".db-pass", ".db-name"].forEach(s => {
            const el = $(s);
            el.style.cssText += ";background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono)";
        });
        [".db-connect", ".db-run"].forEach(s => {
            $(s).style.cssText += ";background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 10px;cursor:pointer";
        });
        $(".db-status").textContent = "not connected";
        $(".db-result").innerHTML = `<div style="padding:10px;color:var(--text-dim)">Not connected — enter connection details and press Connect.</div>`;
        const PORTS = { postgres: "5432", mysql: "3306", clickhouse: "8123", mongodb: "27017", redis: "6379", mssql: "1433" };
        const HINTS = {
            postgres: "SELECT … — ⌘↵ to run", mysql: "SELECT … — ⌘↵ to run",
            clickhouse: "SELECT … — ⌘↵ to run", mssql: "SELECT … — ⌘↵ to run",
            mongodb: 'Command doc, e.g. {"find":"users","filter":{},"limit":50}',
            redis: 'Command line, e.g. KEYS *   or   GET mykey'
        };
        const syncType = () => {
            const t = $(".db-type").value;
            $(".db-port").placeholder = PORTS[t] || "";
            $(".db-sql").placeholder = HINTS[t] || "";
        };
        $(".db-type").onchange = syncType;
        syncType();

        $(".db-connect").onclick = async () => {
            if (connId) { await window.dyo.db.close(connId); connId = null; $(".db-connect").textContent = "Connect"; $(".db-run").disabled = true; $(".db-status").textContent = "disconnected"; return; }
            $(".db-status").textContent = "connecting…";
            const res = await window.dyo.db.connect({
                type: $(".db-type").value,
                host: $(".db-host").value.trim(),
                port: Number($(".db-port").value) || undefined,
                user: $(".db-user").value.trim(),
                password: $(".db-pass").value,
                database: $(".db-name").value.trim()
            });
            if (!res || res.error) { $(".db-status").textContent = "✕ " + ((res && res.error) || "connection failed"); $(".db-status").style.color = "var(--danger)"; return; }
            connId = res.id;
            $(".db-status").style.color = "var(--accent2)";
            $(".db-status").textContent = "● " + (res.version || res.type).split(/[,(]/)[0].trim();
            $(".db-connect").textContent = "Disconnect";
            $(".db-run").disabled = false;
        };

        const run = async () => {
            if (!connId) return;
            const sql = $(".db-sql").value.trim();
            if (!sql) return;
            $(".db-meta").textContent = "running…";
            const r = await window.dyo.db.query(connId, sql);
            if (!r || r.error) { $(".db-result").innerHTML = `<div style="padding:10px;color:var(--danger)">${esc((r && r.error) || "query failed")}</div>`; $(".db-meta").textContent = ""; return; }
            $(".db-meta").textContent = `${r.rowCount} rows · ${r.elapsedMs} ms`;
            const cols = r.columns || [];
            const rows = (r.rows || []).slice(0, 500);
            let html = `<table style="border-collapse:collapse;width:100%;font-family:var(--font-mono);font-size:11.5px"><thead><tr>`;
            cols.forEach(c => html += `<th style="position:sticky;top:0;background:var(--bg-elevated);text-align:left;padding:5px 8px;border-bottom:1px solid var(--border);color:var(--accent)">${esc(c)}</th>`);
            html += `</tr></thead><tbody>`;
            rows.forEach(row => {
                html += `<tr>`;
                cols.forEach(c => {
                    let v = row[c];
                    if (v && typeof v === "object") v = JSON.stringify(v);
                    html += `<td style="padding:4px 8px;border-bottom:1px solid var(--border);white-space:nowrap;max-width:320px;overflow:hidden;text-overflow:ellipsis">${esc(v)}</td>`;
                });
                html += `</tr>`;
            });
            html += `</tbody></table>`;
            if ((r.rows || []).length > 500) html += `<div style="padding:6px 8px;color:var(--text-dim)">… ${r.rows.length - 500} more rows not shown</div>`;
            $(".db-result").innerHTML = html;
        };
        $(".db-run").onclick = run;
        $(".db-sql").addEventListener("keydown", e => { if (e.metaKey && e.key === "Enter") { e.preventDefault(); run(); } });

        return { destroy: () => { if (connId) window.dyo.db.close(connId); } };
    }
};
