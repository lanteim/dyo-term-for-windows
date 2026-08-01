"use strict";
window.I18N.register({
    en: { "widget.msg_jira": "Jira Issues", "cat.messaging": "Messaging" },
    ru: { "widget.msg_jira": "Задачи Jira", "cat.messaging": "Сообщения" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.msg_jira = {
    id: "msg_jira",
    title: "widget.msg_jira",
    category: "messaging",
    description: "Open Jira issues assigned to you (statusCategory != Done)",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div id="_jr_cfg" style="display:none;flex-direction:column;gap:6px">
                <div style="color:var(--text-dim);font-size:11px">Jira base URL, your email and an API token.</div>
                <input id="_jr_url" placeholder="https://your.atlassian.net" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono)"/>
                <input id="_jr_email" placeholder="you@example.com" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono)"/>
                <input id="_jr_token" type="password" placeholder="API token" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono)"/>
                <button id="_jr_save" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;cursor:pointer">Save</button>
              </div>
              <div id="_jr_main" style="display:none;flex-direction:column;gap:6px;height:100%;min-height:0">
                <div style="display:flex;align-items:baseline;gap:8px">
                  <span style="font-size:24px;font-weight:600;color:var(--accent2);font-variant-numeric:tabular-nums" id="_jr_count">—</span>
                  <span style="color:var(--text-dim)">open assigned</span>
                </div>
                <div id="_jr_list" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:2px;min-height:0"></div>
                <div style="display:flex;align-items:center;gap:8px">
                  <button id="_jr_go" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px">Refresh</button>
                  <button id="_jr_edit" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px">Config</button>
                  <span id="_jr_meta" style="color:var(--text-dim);font-size:11px"></span>
                </div>
              </div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, url = "", email = "", token = "";
        const showCfg = show => { $("#_jr_cfg").style.display = show ? "flex" : "none"; $("#_jr_main").style.display = show ? "none" : "flex"; };

        const tick = async () => {
            if (!alive || busy || !url || !email || !token) return;
            busy = true; $("#_jr_meta").textContent = "polling…";
            try {
                const base = url.replace(/\/+$/, "");
                const jql = encodeURIComponent("assignee=currentUser() AND statusCategory!=Done ORDER BY updated DESC");
                const ep = base + "/rest/api/2/search?jql=" + jql + "&maxResults=50&fields=summary,status,priority,key";
                const auth = btoa(email + ":" + token);
                const r = await window.dyo.http(ep, { headers: { Authorization: "Basic " + auth, Accept: "application/json" }, timeout: 10000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_jr_count").textContent = "—";
                    $("#_jr_list").innerHTML = `<span style="color:var(--danger)">${esc((r && r.error) || ("HTTP " + (r && r.status)))}</span>`;
                    $("#_jr_meta").textContent = "unavailable";
                    return;
                }
                let j; try { j = JSON.parse(r.text); } catch (e) { j = null; }
                const arr = (j && j.issues) || [];
                $("#_jr_count").textContent = (j && typeof j.total === "number") ? String(j.total) : String(arr.length);
                const list = $("#_jr_list"); list.innerHTML = "";
                arr.slice(0, 50).forEach(it => {
                    const f = it.fields || {};
                    const div = document.createElement("div");
                    div.style.cssText = "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer";
                    const st = (f.status && f.status.name) || "";
                    div.textContent = (it.key || "?") + "  " + (f.summary || "") + (st ? "  [" + st + "]" : "");
                    div.title = div.textContent;
                    div.onclick = () => window.dyo.openExternal(url.replace(/\/+$/, "") + "/browse/" + it.key);
                    list.appendChild(div);
                });
                if (!arr.length) list.innerHTML = `<span style="color:var(--accent2)">no open issues assigned to you</span>`;
                $("#_jr_meta").textContent = "updated " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) $("#_jr_list").innerHTML = `<span style="color:var(--danger)">${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };

        $("#_jr_save").onclick = async () => {
            url = $("#_jr_url").value.trim(); email = $("#_jr_email").value.trim(); token = $("#_jr_token").value.trim();
            await window.dyo.settings.set({ "msg.jira.url": url, "msg.jira.email": email, "msg.jira.token": token });
            if (url && email && token) { showCfg(false); tick(); }
        };
        $("#_jr_edit").onclick = () => showCfg(true);
        $("#_jr_go").onclick = tick;

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            url = (s && s["msg.jira.url"]) || ""; email = (s && s["msg.jira.email"]) || ""; token = (s && s["msg.jira.token"]) || "";
            $("#_jr_url").value = url; $("#_jr_email").value = email; $("#_jr_token").value = token;
            if (!url || !email || !token) showCfg(true); else { showCfg(false); tick(); }
        });

        const iv = setInterval(tick, 90000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
