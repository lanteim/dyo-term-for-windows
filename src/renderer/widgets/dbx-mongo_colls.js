"use strict";
window.I18N.register({
    en: { "widget.dbx_mongo_colls": "Mongo Collections", "cat.db": "Databases" },
    ru: { "widget.dbx_mongo_colls": "Mongo Коллекции", "cat.db": "Базы данных" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.dbx_mongo_colls = {
    id: "dbx_mongo_colls",
    title: "widget.dbx_mongo_colls",
    category: "db",
    description: "MongoDB collections (listCollections)",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const SKEY = "dbx_mongo_colls";
        const TYPE = "mongodb";
        let connId = null, timer = null, alive = true, busy = false;

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
              <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
                <span style="color:var(--accent);font-weight:600">mongodb</span>
                <input class="_h" placeholder="host" value="127.0.0.1" style="width:110px"/>
                <input class="_p" placeholder="27017" style="width:64px"/>
                <input class="_u" placeholder="user (opt)" style="width:90px"/>
                <input class="_pw" placeholder="password (opt)" type="password" style="width:110px"/>
                <input class="_d" placeholder="database" style="width:110px"/>
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

        const extract = r => {
            // Try to find the collection docs regardless of exact shape.
            if (!r) return [];
            const cand = [];
            const scan = obj => {
                if (!obj || typeof obj !== "object") return;
                if (obj.cursor && obj.cursor.firstBatch) cand.push(...obj.cursor.firstBatch);
                if (Array.isArray(obj.firstBatch)) cand.push(...obj.firstBatch);
            };
            if (Array.isArray(r.rows)) { r.rows.forEach(row => { if (row && (row.name || row.type)) cand.push(row); else scan(row); }); }
            scan(r);
            if (!cand.length && Array.isArray(r.rows)) return r.rows;
            return cand;
        };

        const tick = async () => {
            if (busy || !connId || !alive) return;
            busy = true;
            const r = await window.dyo.db.query(connId, '{"listCollections":1}');
            busy = false;
            if (!alive || !connId) return;
            if (r && r.error) { $("._r").innerHTML = `<div style="padding:10px;color:var(--danger)">${esc(r.error)}</div>`; return; }
            const cols = extract(r);
            $("._sum").innerHTML = `<span>collections <b style="color:var(--accent2)">${cols.length}</b></span>`;
            if (!cols.length) { $("._r").innerHTML = `<div style="padding:12px;color:var(--text-dim)">No collections found in this database.</div>`; return; }
            let h = `<table style="border-collapse:collapse;width:100%;font-family:var(--font-mono);font-size:11.5px"><thead><tr>`;
            ["name", "type", "options"].forEach(c => h += `<th style="position:sticky;top:0;background:var(--bg-elevated);text-align:left;padding:5px 8px;border-bottom:1px solid var(--border);color:var(--accent)">${c}</th>`);
            h += `</tr></thead><tbody>`;
            cols.slice(0, 200).forEach(x => {
                let opts = x.options; if (opts && typeof opts === "object") opts = JSON.stringify(opts);
                h += `<tr><td style="padding:4px 8px;border-bottom:1px solid var(--border);color:var(--accent2)">${esc(x.name)}</td>`
                    + `<td style="padding:4px 8px;border-bottom:1px solid var(--border)">${esc(x.type)}</td>`
                    + `<td style="padding:4px 8px;border-bottom:1px solid var(--border);color:var(--text-dim);max-width:480px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(opts)}</td></tr>`;
            });
            h += `</tbody></table>`;
            $("._r").innerHTML = h;
        };

        $("._go").onclick = async () => {
            if (connId) { const id = connId; connId = null; if (timer) clearInterval(timer); timer = null; await window.dyo.db.close(id); $("._go").textContent = "Connect"; status("disconnected"); $("._st").style.color = "var(--text-dim)"; return; }
            status("connecting…"); $("._st").style.color = "var(--text-dim)";
            const cfg = { type: TYPE, host: $("._h").value.trim(), port: Number($("._p").value) || 27017, user: $("._u").value.trim() || undefined, password: $("._pw").value || undefined, database: $("._d").value.trim() };
            const res = await window.dyo.db.connect(cfg);
            if (!alive) { if (res && res.id) window.dyo.db.close(res.id); return; }
            if (!res || res.error) { status("✕ " + ((res && res.error) || "connection failed"), true); return; }
            connId = res.id;
            status("● " + String(res.version || TYPE).split(/[,(]/)[0].trim());
            const patch = {}; patch[SKEY] = { host: cfg.host, port: cfg.port, user: $("._u").value.trim(), database: cfg.database }; window.dyo.settings.set(patch);
            $("._go").textContent = "Disconnect";
            tick();
            timer = setInterval(tick, 4000);
        };

        return { destroy: () => { alive = false; if (timer) clearInterval(timer); if (connId) window.dyo.db.close(connId); } };
    }
};
