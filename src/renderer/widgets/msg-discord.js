"use strict";
window.I18N.register({
    en: { "widget.msg_discord": "Discord Webhook", "cat.messaging": "Messaging" },
    ru: { "widget.msg_discord": "Discord вебхук", "cat.messaging": "Сообщения" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.msg_discord = {
    id: "msg_discord",
    title: "widget.msg_discord",
    category: "messaging",
    description: "Send a message to a Discord channel via webhook URL",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div id="_dc_cfg" style="display:none;flex-direction:column;gap:6px">
                <div style="color:var(--text-dim);font-size:11px">Discord channel webhook URL (Channel → Integrations → Webhooks).</div>
                <input id="_dc_url" type="password" placeholder="https://discord.com/api/webhooks/…" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono)"/>
                <button id="_dc_save" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;cursor:pointer">Save</button>
              </div>
              <div id="_dc_main" style="display:none;flex-direction:column;gap:6px;height:100%;min-height:0">
                <textarea id="_dc_msg" placeholder="Message…" style="flex:1;min-height:60px;resize:none;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px;font-family:var(--font-mono);font-size:12px"></textarea>
                <div style="display:flex;align-items:center;gap:8px">
                  <button id="_dc_send" style="background:var(--accent);color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer">Send</button>
                  <button id="_dc_edit" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px">Webhook</button>
                  <span id="_dc_meta" style="color:var(--text-dim);font-size:11px"></span>
                </div>
              </div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, url = "";
        const showCfg = show => { $("#_dc_cfg").style.display = show ? "flex" : "none"; $("#_dc_main").style.display = show ? "none" : "flex"; };

        const send = async () => {
            if (!alive || busy || !url) return;
            const content = $("#_dc_msg").value;
            if (!content.trim()) { $("#_dc_meta").textContent = "empty message"; $("#_dc_meta").style.color = "var(--text-dim)"; return; }
            busy = true; $("#_dc_send").disabled = true; $("#_dc_meta").textContent = "sending…"; $("#_dc_meta").style.color = "var(--text-dim)";
            try {
                const r = await window.dyo.http(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content: content.slice(0, 2000) }),
                    timeout: 8000
                });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_dc_meta").textContent = "failed: " + esc((r && r.error) || ("HTTP " + (r && r.status)));
                    $("#_dc_meta").style.color = "var(--danger)"; return;
                }
                $("#_dc_msg").value = "";
                $("#_dc_meta").textContent = "sent " + new Date().toLocaleTimeString();
                $("#_dc_meta").style.color = "var(--accent2)";
            } catch (e) {
                if (alive) { $("#_dc_meta").textContent = esc(e && e.message); $("#_dc_meta").style.color = "var(--danger)"; }
            } finally { busy = false; if (alive) $("#_dc_send").disabled = false; }
        };

        $("#_dc_save").onclick = async () => {
            url = $("#_dc_url").value.trim();
            await window.dyo.settings.set({ "msg.discord.webhook": url });
            if (url) showCfg(false);
        };
        $("#_dc_edit").onclick = () => showCfg(true);
        $("#_dc_send").onclick = send;
        $("#_dc_msg").onkeydown = e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); send(); } };

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            url = (s && s["msg.discord.webhook"]) || "";
            $("#_dc_url").value = url;
            if (!url) showCfg(true); else showCfg(false);
        });

        return { destroy: () => { alive = false; } };
    }
};
