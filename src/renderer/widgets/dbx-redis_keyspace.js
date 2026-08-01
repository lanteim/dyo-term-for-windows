"use strict";
window.I18N.register({
    en: { "widget.dbx_redis_keyspace": "Redis Keyspace", "cat.db": "Databases" },
    ru: { "widget.dbx_redis_keyspace": "Redis Keyspace", "cat.db": "Базы данных" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.dbx_redis_keyspace = {
    id: "dbx_redis_keyspace",
    title: "widget.dbx_redis_keyspace",
    category: "db",
    description: "Redis keyspace (INFO keyspace + DBSIZE)",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const SKEY = "dbx_redis_keyspace";
        const TYPE = "redis";
        let connId = null, timer = null, alive = true, busy = false;

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
              <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
                <span style="color:var(--accent);font-weight:600">redis</span>
                <input class="_h" placeholder="host" value="127.0.0.1" style="width:110px"/>
                <input class="_p" placeholder="6379" style="width:60px"/>
                <input class="_u" placeholder="user (opt)" style="width:90px"/>
                <input class="_pw" placeholder="password (opt)" type="password" style="width:110px"/>
                <input class="_d" placeholder="db # (opt)" style="width:70px"/>
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
            if (c.database != null && c.database !== "") $("._d").value = c.database;
        })();

        const status = (t, bad) => { const el = $("._st"); if (!el) return; el.textContent = t; el.style.color = bad ? "var(--danger)" : "var(--accent2)"; };
        const flat = r => {
            if (r == null) return "";
            if (typeof r === "string") return r;
            if (Array.isArray(r)) return r.map(flat).join("\n");
            if (Array.isArray(r.rows)) return r.rows.map(row => (row && typeof row === "object") ? Object.values(row).map(v => (v && typeof v === "object") ? JSON.stringify(v) : String(v)).join(" ") : String(row)).join("\n");
            return JSON.stringify(r);
        };

        const tick = async () => {
            if (busy || !connId || !alive) return;
            busy = true;
            const info = await window.dyo.db.query(connId, "INFO keyspace");
            const size = await window.dyo.db.query(connId, "DBSIZE");
            busy = false;
            if (!alive || !connId) return;
            if (info && info.error) { $("._r").innerHTML = `<div style="padding:10px;color:var(--danger)">${esc(info.error)}</div>`; return; }
            const txt = flat(info);
            const dbs = [];
            txt.split(/\r?\n/).forEach(line => {
                const m = line.match(/^db(\d+):(.*)$/);
                if (!m) return;
                const o = { db: "db" + m[1] };
                m[2].split(",").forEach(kv => { const p = kv.split("="); if (p.length === 2) o[p[0].trim()] = p[1].trim(); });
                dbs.push(o);
            });
            const sizeTxt = flat(size).trim();
            const total = dbs.reduce((a, d) => a + (Number(d.keys) || 0), 0);
            $("._sum").innerHTML = `<span>DBSIZE <b style="color:var(--text)">${esc(sizeTxt || "?")}</b></span>`
                + `<span>keyspace dbs <b style="color:var(--accent2)">${dbs.length}</b></span>`
                + `<span>total keys <b style="color:var(--text)">${total}</b></span>`;
            if (!dbs.length) { $("._r").innerHTML = `<div style="padding:12px;color:var(--text-dim)">No populated databases (keyspace empty).</div>`; return; }
            let h = `<table style="border-collapse:collapse;width:100%;font-family:var(--font-mono);font-size:11.5px"><thead><tr>`;
            ["db", "keys", "expires", "avg_ttl"].forEach(c => h += `<th style="position:sticky;top:0;background:var(--bg-elevated);text-align:left;padding:5px 8px;border-bottom:1px solid var(--border);color:var(--accent)">${c}</th>`);
            h += `</tr></thead><tbody>`;
            dbs.forEach(x => {
                h += `<tr><td style="padding:4px 8px;border-bottom:1px solid var(--border);color:var(--accent2)">${esc(x.db)}</td>`
                    + `<td style="padding:4px 8px;border-bottom:1px solid var(--border)">${esc(x.keys)}</td>`
                    + `<td style="padding:4px 8px;border-bottom:1px solid var(--border)">${esc(x.expires)}</td>`
                    + `<td style="padding:4px 8px;border-bottom:1px solid var(--border);color:var(--text-dim)">${esc(x.avg_ttl)}</td></tr>`;
            });
            h += `</tbody></table>`;
            $("._r").innerHTML = h;
        };

        $("._go").onclick = async () => {
            if (connId) { const id = connId; connId = null; if (timer) clearInterval(timer); timer = null; await window.dyo.db.close(id); $("._go").textContent = "Connect"; status("disconnected"); $("._st").style.color = "var(--text-dim)"; return; }
            status("connecting…"); $("._st").style.color = "var(--text-dim)";
            const dbv = $("._d").value.trim();
            const cfg = { type: TYPE, host: $("._h").value.trim(), port: Number($("._p").value) || 6379, user: $("._u").value.trim() || undefined, password: $("._pw").value || undefined, database: dbv === "" ? undefined : (Number(dbv) || 0) };
            const res = await window.dyo.db.connect(cfg);
            if (!alive) { if (res && res.id) window.dyo.db.close(res.id); return; }
            if (res.error) { status("✕ " + res.error, true); return; }
            connId = res.id;
            status("● " + String(res.version || TYPE).split(/[,(]/)[0].trim());
            const patch = {}; patch[SKEY] = { host: cfg.host, port: cfg.port, user: $("._u").value.trim(), database: dbv }; window.dyo.settings.set(patch);
            $("._go").textContent = "Disconnect";
            tick();
            timer = setInterval(tick, 4000);
        };

        return { destroy: () => { alive = false; if (timer) clearInterval(timer); if (connId) window.dyo.db.close(connId); } };
    }
};
