"use strict";
window.I18N.register({
    en: { "widget.msg_linear": "Linear", "cat.messaging": "Messaging" },
    ru: { "widget.msg_linear": "Linear", "cat.messaging": "Сообщения" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.msg_linear = {
    id: "msg_linear",
    title: "widget.msg_linear",
    category: "messaging",
    description: "Linear issues assigned to you (GraphQL viewer.assignedIssues)",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div id="_ln_cfg" style="display:none;flex-direction:column;gap:6px">
                <div style="color:var(--text-dim);font-size:11px">Linear personal API key (Settings → API).</div>
                <input id="_ln_key" type="password" placeholder="lin_api_…" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono)"/>
                <button id="_ln_save" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;cursor:pointer">Save</button>
              </div>
              <div id="_ln_main" style="display:none;flex-direction:column;gap:6px;height:100%;min-height:0">
                <div style="display:flex;align-items:baseline;gap:8px">
                  <span style="font-size:24px;font-weight:600;color:var(--accent2);font-variant-numeric:tabular-nums" id="_ln_count">—</span>
                  <span style="color:var(--text-dim)">assigned open</span>
                  <span id="_ln_who" style="color:var(--text-dim);margin-left:auto;font-size:11px"></span>
                </div>
                <div id="_ln_list" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:2px;min-height:0"></div>
                <div style="display:flex;align-items:center;gap:8px">
                  <button id="_ln_go" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px">Refresh</button>
                  <button id="_ln_edit" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px">Key</button>
                  <span id="_ln_meta" style="color:var(--text-dim);font-size:11px"></span>
                </div>
              </div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, key = "";
        const showCfg = show => { $("#_ln_cfg").style.display = show ? "flex" : "none"; $("#_ln_main").style.display = show ? "none" : "flex"; };

        const query = `query { viewer { name assignedIssues(filter:{completedAt:{null:true},canceledAt:{null:true}}, first:50, orderBy:updatedAt) { nodes { identifier title url state { name } } } } }`;

        const tick = async () => {
            if (!alive || busy || !key) return;
            busy = true; $("#_ln_meta").textContent = "polling…";
            try {
                const r = await window.dyo.http("https://api.linear.app/graphql", {
                    method: "POST",
                    headers: { Authorization: key, "Content-Type": "application/json" },
                    body: JSON.stringify({ query }),
                    timeout: 10000
                });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_ln_count").textContent = "—";
                    $("#_ln_list").innerHTML = `<span style="color:var(--danger)">${esc((r && r.error) || ("HTTP " + (r && r.status)))}</span>`;
                    $("#_ln_meta").textContent = "unavailable";
                    return;
                }
                let j; try { j = JSON.parse(r.text); } catch (e) { j = null; }
                if (!j || j.errors || !j.data || !j.data.viewer) {
                    $("#_ln_count").textContent = "—";
                    $("#_ln_list").innerHTML = `<span style="color:var(--danger)">${esc(j && j.errors ? (j.errors[0] && j.errors[0].message) : "bad response")}</span>`;
                    $("#_ln_meta").textContent = "error";
                    return;
                }
                const v = j.data.viewer;
                $("#_ln_who").textContent = v.name || "";
                const nodes = (v.assignedIssues && v.assignedIssues.nodes) || [];
                $("#_ln_count").textContent = String(nodes.length);
                const list = $("#_ln_list"); list.innerHTML = "";
                nodes.slice(0, 50).forEach(it => {
                    const div = document.createElement("div");
                    div.style.cssText = "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer";
                    const st = (it.state && it.state.name) || "";
                    div.textContent = (it.identifier || "?") + "  " + (it.title || "") + (st ? "  [" + st + "]" : "");
                    div.title = div.textContent;
                    if (it.url) div.onclick = () => window.dyo.openExternal(it.url);
                    list.appendChild(div);
                });
                if (!nodes.length) list.innerHTML = `<span style="color:var(--accent2)">no open issues assigned to you</span>`;
                $("#_ln_meta").textContent = "updated " + new Date().toLocaleTimeString(window.I18N.locale());
            } catch (e) {
                if (alive) $("#_ln_list").innerHTML = `<span style="color:var(--danger)">${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };

        $("#_ln_save").onclick = async () => {
            key = $("#_ln_key").value.trim();
            await window.dyo.settings.set({ "msg.linear.apiKey": key });
            if (key) { showCfg(false); tick(); }
        };
        $("#_ln_edit").onclick = () => showCfg(true);
        $("#_ln_go").onclick = tick;

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            key = (s && s["msg.linear.apiKey"]) || "";
            $("#_ln_key").value = key;
            if (!key) showCfg(true); else { showCfg(false); tick(); }
        });

        const iv = setInterval(tick, 90000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
