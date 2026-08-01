"use strict";
window.I18N.register({
    en: { "widget.api_wstest": "WebSocket Tester", "cat.web": "Web" },
    ru: { "widget.api_wstest": "WebSocket тестер", "cat.web": "Веб" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.api_wstest = {
    id: "api_wstest",
    title: "widget.api_wstest",
    category: "web",
    description: "Connect to a ws:// or wss:// endpoint, send messages and view incoming frames",
    defaultSize: { w: 8, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const SKEY = "api.wstest.url";
        let alive = true, sock = null, rows = [];

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <span style="color:var(--accent);font-weight:600">ws</span>
              <input id="_ws_url" placeholder="wss://echo.websocket.org" style="flex:1;min-width:160px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <button id="_ws_conn" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 10px;cursor:pointer;font-family:var(--font-mono)">Connect</button>
              <span id="_ws_st" style="color:var(--text-dim)">idle</span>
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              <input id="_ws_msg" placeholder="message to send…" style="flex:1;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <button id="_ws_send" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 10px;cursor:pointer;font-family:var(--font-mono)">Send</button>
            </div>
            <div id="_ws_log" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;font-family:var(--font-mono);font-size:11px;padding:4px"></div>
          </div>`;
        const $ = s => body.querySelector(s);

        window.dyo.settings.get().then(s => { if (alive && s && s[SKEY]) $("#_ws_url").value = s[SKEY]; });

        const add = (dir, text, color) => {
            const t = new Date().toLocaleTimeString();
            rows.push(`<div style="padding:2px 4px;border-bottom:1px solid var(--border);white-space:pre-wrap;word-break:break-all"><span style="color:var(--text-dim)">${esc(t)}</span> <span style="color:${color}">${esc(dir)}</span> ${esc(text)}</div>`);
            if (rows.length > 200) rows = rows.slice(-200);
            const el = $("#_ws_log"); el.innerHTML = rows.join(""); el.scrollTop = el.scrollHeight;
        };

        const setSt = (t, c) => { $("#_ws_st").textContent = t; $("#_ws_st").style.color = c || "var(--text-dim)"; };

        const closeSock = () => { if (sock) { try { sock.onclose = null; sock.close(); } catch (e) { } sock = null; } };

        const connect = () => {
            const url = $("#_ws_url").value.trim();
            if (!/^wss?:\/\//i.test(url)) { add("!", "URL must start with ws:// or wss://", "var(--danger)"); return; }
            closeSock();
            window.dyo.settings.set({ [SKEY]: url });
            setSt("connecting…", "var(--accent2)");
            try {
                sock = new WebSocket(url);
            } catch (e) { add("!", "bad URL: " + (e && e.message), "var(--danger)"); setSt("error", "var(--danger)"); return; }
            sock.onopen = () => { if (!alive) return; setSt("connected", "var(--accent)"); $("#_ws_conn").textContent = "Disconnect"; add("»", "connection open", "var(--accent)"); };
            sock.onmessage = ev => { if (!alive) return; const d = typeof ev.data === "string" ? ev.data : "[binary " + (ev.data && ev.data.size || "?") + "B]"; add("◂ IN", d, "var(--accent2)"); };
            sock.onerror = () => { if (!alive) return; add("!", "socket error", "var(--danger)"); setSt("error", "var(--danger)"); };
            sock.onclose = ev => { if (!alive) return; setSt("closed (" + (ev && ev.code) + ")", "var(--text-dim)"); $("#_ws_conn").textContent = "Connect"; add("×", "closed code=" + (ev && ev.code), "var(--text-dim)"); sock = null; };
        };

        $("#_ws_conn").onclick = () => { if (sock && (sock.readyState === 0 || sock.readyState === 1)) { closeSock(); setSt("closed", "var(--text-dim)"); $("#_ws_conn").textContent = "Connect"; add("×", "closed by user", "var(--text-dim)"); } else connect(); };
        const send = () => {
            const m = $("#_ws_msg").value;
            if (!sock || sock.readyState !== 1) { add("!", "not connected", "var(--danger)"); return; }
            try { sock.send(m); add("▸ OUT", m, "var(--text)"); $("#_ws_msg").value = ""; } catch (e) { add("!", "send failed: " + (e && e.message), "var(--danger)"); }
        };
        $("#_ws_send").onclick = send;
        $("#_ws_msg").addEventListener("keydown", e => { if (e.key === "Enter") send(); });
        $("#_ws_url").addEventListener("keydown", e => { if (e.key === "Enter") connect(); });

        return { destroy: () => { alive = false; closeSock(); } };
    }
};
