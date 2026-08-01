"use strict";
window.I18N.register({
    en: { "widget.msg_telegram": "Telegram Bot", "cat.messaging": "Messaging" },
    ru: { "widget.msg_telegram": "Телеграм-бот", "cat.messaging": "Сообщения" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.msg_telegram = {
    id: "msg_telegram",
    title: "widget.msg_telegram",
    category: "messaging",
    description: "Telegram bot identity + pending update count (getMe / getUpdates)",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div id="_tg_cfg" style="display:none;flex-direction:column;gap:6px">
                <div style="color:var(--text-dim);font-size:11px">Bot token from @BotFather.</div>
                <input id="_tg_token" type="password" placeholder="123456:ABC-…" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono)"/>
                <button id="_tg_save" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;cursor:pointer">Save</button>
              </div>
              <div id="_tg_main" style="display:none;flex-direction:column;gap:6px;height:100%;min-height:0">
                <div class="metric-row"><span class="k">BOT</span><span class="v" id="_tg_bot">…</span></div>
                <div style="display:flex;align-items:baseline;gap:8px">
                  <span style="font-size:24px;font-weight:600;color:var(--accent2);font-variant-numeric:tabular-nums" id="_tg_count">—</span>
                  <span style="color:var(--text-dim)">pending updates</span>
                </div>
                <div id="_tg_list" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:2px;min-height:0"></div>
                <div style="display:flex;align-items:center;gap:8px">
                  <button id="_tg_go" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px">Refresh</button>
                  <button id="_tg_edit" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px">Token</button>
                  <span id="_tg_meta" style="color:var(--text-dim);font-size:11px"></span>
                </div>
              </div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, token = "";
        const showCfg = show => { $("#_tg_cfg").style.display = show ? "flex" : "none"; $("#_tg_main").style.display = show ? "none" : "flex"; };

        const api = async (method) => {
            const r = await window.dyo.http("https://api.telegram.org/bot" + encodeURIComponent(token) + "/" + method, { timeout: 8000 });
            if (!r || r.error || !r.ok) return { _err: (r && r.error) || ("HTTP " + (r && r.status)) };
            try { return JSON.parse(r.text); } catch (e) { return { _err: "bad response" }; }
        };

        const tick = async () => {
            if (!alive || busy || !token) return;
            busy = true; $("#_tg_meta").textContent = "polling…";
            try {
                const me = await api("getMe");
                if (!alive) return;
                if (me._err || !me.ok) {
                    $("#_tg_bot").textContent = "auth failed"; $("#_tg_bot").style.color = "var(--danger)";
                    $("#_tg_meta").textContent = esc(me._err || (me.description) || "error"); return;
                }
                $("#_tg_bot").textContent = "@" + ((me.result && me.result.username) || "?"); $("#_tg_bot").style.color = "var(--text)";
                const up = await api("getUpdates");
                if (!alive) return;
                const arr = (up.ok && up.result) || [];
                $("#_tg_count").textContent = String(arr.length);
                $("#_tg_count").style.color = arr.length ? "var(--accent2)" : "var(--text-dim)";
                const list = $("#_tg_list"); list.innerHTML = "";
                arr.slice(-50).reverse().forEach(u => {
                    const m = u.message || u.edited_message || u.channel_post || {};
                    const from = (m.from && (m.from.username || m.from.first_name)) || (m.chat && m.chat.title) || "?";
                    const txt = m.text || (m.sticker ? "[sticker]" : (m.photo ? "[photo]" : "[update]"));
                    const div = document.createElement("div");
                    div.style.cssText = "white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
                    div.textContent = "• " + from + ": " + txt;
                    div.title = div.textContent;
                    list.appendChild(div);
                });
                if (!arr.length) list.innerHTML = `<span style="color:var(--text-dim)">no pending updates (may be consumed by a webhook)</span>`;
                $("#_tg_meta").textContent = "updated " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) $("#_tg_list").innerHTML = `<span style="color:var(--danger)">${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };

        $("#_tg_save").onclick = async () => {
            token = $("#_tg_token").value.trim();
            await window.dyo.settings.set({ "msg.telegram.token": token });
            if (token) { showCfg(false); tick(); }
        };
        $("#_tg_edit").onclick = () => showCfg(true);
        $("#_tg_go").onclick = tick;

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            token = (s && s["msg.telegram.token"]) || "";
            $("#_tg_token").value = token;
            if (!token) showCfg(true); else { showCfg(false); tick(); }
        });

        const iv = setInterval(tick, 30000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
