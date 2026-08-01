"use strict";
window.I18N.register({
    en: { "widget.dbx_myprocess": "MySQL Processlist", "cat.db": "Databases" },
    ru: { "widget.dbx_myprocess": "MySQL Процессы", "cat.db": "Базы данных" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.dbx_myprocess = {
    id: "dbx_myprocess",
    title: "widget.dbx_myprocess",
    category: "db",
    description: "Live SHOW FULL PROCESSLIST monitor",
    defaultSize: { w: 12, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const SKEY = "dbx_myprocess";
        const TYPE = "mysql";
        let connId = null, timer = null, alive = true, busy = false;

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
              <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
                <span style="color:var(--accent);font-weight:600">mysql</span>
                <input class="_h" placeholder="host" value="127.0.0.1" style="width:110px"/>
                <input class="_p" placeholder="3306" style="width:60px"/>
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
        const COLS = ["Id", "User", "Host", "db", "Command", "Time", "State", "Info"];

        const tick = async () => {
            if (busy || !connId || !alive) return;
            busy = true;
            const r = await window.dyo.db.query(connId, "SHOW FULL PROCESSLIST");
            busy = false;
            if (!alive || !connId) return;
            if (r.error) { $("._r").innerHTML = `<div style="padding:10px;color:var(--danger)">${esc(r.error)}</div>`; return; }
            const rows = r.rows || [];
            const norm = rows.map(x => { const o = {}; COLS.forEach(c => { o[c] = x[c] != null ? x[c] : x[c.toLowerCase()] != null ? x[c.toLowerCase()] : x[c.toUpperCase()]; }); return o; });
            let running = 0, sleeping = 0;
            norm.forEach(x => { const c = String(x.Command || "").toLowerCase(); if (c === "sleep") sleeping++; else running++; });
            $("._sum").innerHTML = `<span>total <b style="color:var(--text)">${norm.length}</b></span>`
                + `<span>running <b style="color:var(--accent2)">${running}</b></span>`
                + `<span>sleeping <b style="color:var(--text-dim)">${sleeping}</b></span>`;
            let h = `<table style="border-collapse:collapse;width:100%;font-family:var(--font-mono);font-size:11.5px"><thead><tr>`;
            COLS.forEach(c => h += `<th style="position:sticky;top:0;background:var(--bg-elevated);text-align:left;padding:5px 8px;border-bottom:1px solid var(--border);color:var(--accent)">${c}</th>`);
            h += `</tr></thead><tbody>`;
            norm.slice(0, 200).forEach(x => {
                const sleep = String(x.Command || "").toLowerCase() === "sleep";
                h += `<tr style="color:${sleep ? 'var(--text-dim)' : 'var(--text)'}">`;
                COLS.forEach(c => {
                    const wide = c === "Info";
                    h += `<td style="padding:4px 8px;border-bottom:1px solid var(--border);${wide ? 'max-width:420px;overflow:hidden;text-overflow:ellipsis;' : ''}white-space:nowrap">${esc(x[c])}</td>`;
                });
                h += `</tr>`;
            });
            h += `</tbody></table>`;
            $("._r").innerHTML = h;
        };

        $("._go").onclick = async () => {
            if (connId) { const id = connId; connId = null; if (timer) clearInterval(timer); timer = null; await window.dyo.db.close(id); $("._go").textContent = "Connect"; status("disconnected"); $("._st").style.color = "var(--text-dim)"; return; }
            status("connecting…"); $("._st").style.color = "var(--text-dim)";
            const cfg = { type: TYPE, host: $("._h").value.trim(), port: Number($("._p").value) || 3306, user: $("._u").value.trim(), password: $("._pw").value, database: $("._d").value.trim() };
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
