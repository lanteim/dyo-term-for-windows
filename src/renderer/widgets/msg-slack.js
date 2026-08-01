"use strict";
window.I18N.register({
    en: { "widget.msg_slack": "Slack", "cat.messaging": "Messaging" },
    ru: { "widget.msg_slack": "Slack", "cat.messaging": "Сообщения" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.msg_slack = {
    id: "msg_slack",
    title: "widget.msg_slack",
    category: "messaging",
    description: "Slack connection: workspace + connected user via auth.test",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div id="_sl_cfg" style="display:none;flex-direction:column;gap:6px">
                <div style="color:var(--text-dim);font-size:11px">Paste a Slack token (xoxb-… or xoxp-…). Used only for auth.test.</div>
                <input id="_sl_token" type="password" placeholder="xoxb-…" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono)"/>
                <button id="_sl_save" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;cursor:pointer">Save</button>
              </div>
              <div id="_sl_main" style="display:none;flex-direction:column;gap:6px;height:100%">
                <div class="metric-row"><span class="k">STATUS</span><span class="v" id="_sl_status">…</span></div>
                <div class="metric-row"><span class="k">WORKSPACE</span><span class="v" id="_sl_team" style="max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">—</span></div>
                <div class="metric-row"><span class="k">USER</span><span class="v" id="_sl_user" style="max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">—</span></div>
                <div class="metric-row"><span class="k">URL</span><span class="v" id="_sl_url" style="max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;color:var(--accent)" title="Open">—</span></div>
                <div style="display:flex;align-items:center;gap:8px;margin-top:auto">
                  <button id="_sl_go" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px">Refresh</button>
                  <button id="_sl_edit" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px">Token</button>
                  <span id="_sl_meta" style="color:var(--text-dim);font-size:11px"></span>
                </div>
              </div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, token = "";
        const showCfg = show => { $("#_sl_cfg").style.display = show ? "flex" : "none"; $("#_sl_main").style.display = show ? "none" : "flex"; };

        $("#_sl_url").onclick = () => { const t = $("#_sl_url").textContent.trim(); if (t && t !== "—") window.dyo.openExternal(t); };

        const tick = async () => {
            if (!alive || busy || !token) return;
            busy = true; $("#_sl_meta").textContent = "checking…";
            try {
                const r = await window.dyo.http("https://slack.com/api/auth.test", {
                    method: "POST",
                    headers: { Authorization: "Bearer " + token, "Content-Type": "application/x-www-form-urlencoded" },
                    timeout: 8000
                });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_sl_status").textContent = "unreachable"; $("#_sl_status").style.color = "var(--danger)";
                    $("#_sl_meta").textContent = (r && r.error) ? "offline" : ("HTTP " + (r && r.status));
                    return;
                }
                let j; try { j = JSON.parse(r.text); } catch (e) { j = null; }
                if (!j || !j.ok) {
                    $("#_sl_status").textContent = "not connected"; $("#_sl_status").style.color = "var(--danger)";
                    $("#_sl_team").textContent = "—"; $("#_sl_user").textContent = "—"; $("#_sl_url").textContent = "—";
                    $("#_sl_meta").textContent = (j && j.error) ? esc(j.error) : "auth failed";
                    return;
                }
                $("#_sl_status").textContent = "connected"; $("#_sl_status").style.color = "var(--accent2)";
                $("#_sl_team").textContent = j.team || "—";
                $("#_sl_user").textContent = j.user || "—";
                $("#_sl_url").textContent = j.url || "—";
                $("#_sl_meta").textContent = "updated " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) { $("#_sl_status").textContent = "error"; $("#_sl_status").style.color = "var(--danger)"; $("#_sl_meta").textContent = esc(e && e.message); }
            } finally { busy = false; }
        };

        $("#_sl_save").onclick = async () => {
            token = $("#_sl_token").value.trim();
            await window.dyo.settings.set({ "msg.slack.token": token });
            if (token) { showCfg(false); tick(); }
        };
        $("#_sl_edit").onclick = () => showCfg(true);
        $("#_sl_go").onclick = tick;

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            token = (s && s["msg.slack.token"]) || "";
            $("#_sl_token").value = token;
            if (!token) showCfg(true); else { showCfg(false); tick(); }
        });

        const iv = setInterval(tick, 60000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
