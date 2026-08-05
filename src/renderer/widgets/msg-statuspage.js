"use strict";
window.I18N.register({
    en: { "widget.msg_statuspage": "Statuspage", "cat.messaging": "Messaging" },
    ru: { "widget.msg_statuspage": "Статус-страница", "cat.messaging": "Сообщения" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.msg_statuspage = {
    id: "msg_statuspage",
    title: "widget.msg_statuspage",
    category: "messaging",
    description: "Component statuses from a statuspage.io summary.json",
    defaultSize: { w: 6, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div id="_sp_cfg" style="display:none;flex-direction:column;gap:6px">
                <div style="color:var(--text-dim);font-size:11px">Statuspage summary.json URL, e.g. https://www.githubstatus.com/api/v2/summary.json</div>
                <input id="_sp_url" placeholder="https://…/api/v2/summary.json" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono)"/>
                <button id="_sp_save" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;cursor:pointer">Save</button>
              </div>
              <div id="_sp_main" style="display:none;flex-direction:column;gap:6px;height:100%;min-height:0">
                <div id="_sp_overall" style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">—</div>
                <div id="_sp_list" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:2px;min-height:0"></div>
                <div style="display:flex;align-items:center;gap:8px">
                  <button id="_sp_go" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px">Refresh</button>
                  <button id="_sp_edit" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px">URL</button>
                  <span id="_sp_meta" style="color:var(--text-dim);font-size:11px"></span>
                </div>
              </div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, url = "";
        const showCfg = show => { $("#_sp_cfg").style.display = show ? "flex" : "none"; $("#_sp_main").style.display = show ? "none" : "flex"; };
        const colorFor = st => st === "operational" ? "var(--accent2)" : (st === "major_outage" ? "var(--danger)" : (st === "degraded_performance" || st === "partial_outage" ? "var(--accent)" : "var(--text-dim)"));

        const tick = async () => {
            if (!alive || busy || !url) return;
            busy = true; $("#_sp_meta").textContent = "polling…";
            try {
                const r = await window.dyo.http(url, { headers: { Accept: "application/json" }, timeout: 10000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_sp_list").innerHTML = `<span style="color:var(--danger)">${esc((r && r.error) || ("HTTP " + (r && r.status)))}</span>`;
                    $("#_sp_meta").textContent = "unavailable"; return;
                }
                let j; try { j = JSON.parse(r.text); } catch (e) { j = null; }
                if (!j) { $("#_sp_list").innerHTML = `<span style="color:var(--danger)">bad JSON</span>`; $("#_sp_meta").textContent = "parse error"; return; }
                const ind = (j.status && j.status.indicator) || "unknown";
                const desc = (j.status && j.status.description) || "";
                const pageName = (j.page && j.page.name) || "";
                $("#_sp_overall").textContent = (pageName ? pageName + " — " : "") + desc;
                $("#_sp_overall").style.color = ind === "none" ? "var(--accent2)" : (ind === "critical" ? "var(--danger)" : "var(--accent)");
                const comps = (j.components || []).filter(c => !c.group);
                const list = $("#_sp_list"); list.innerHTML = "";
                comps.slice(0, 100).forEach(c => {
                    const row = document.createElement("div");
                    row.className = "metric-row";
                    row.innerHTML = `<span class="k" style="max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</span>` +
                        `<span class="v" style="color:${colorFor(c.status)}">${esc((c.status || "").replace(/_/g, " "))}</span>`;
                    list.appendChild(row);
                });
                if (!comps.length) list.innerHTML = `<span style="color:var(--text-dim)">no components reported</span>`;
                $("#_sp_meta").textContent = "updated " + new Date().toLocaleTimeString(window.I18N.locale());
            } catch (e) {
                if (alive) $("#_sp_list").innerHTML = `<span style="color:var(--danger)">${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };

        $("#_sp_save").onclick = async () => {
            url = $("#_sp_url").value.trim();
            await window.dyo.settings.set({ "msg.statuspage.url": url });
            if (url) { showCfg(false); tick(); }
        };
        $("#_sp_edit").onclick = () => showCfg(true);
        $("#_sp_go").onclick = tick;

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            url = (s && s["msg.statuspage.url"]) || "";
            $("#_sp_url").value = url;
            if (!url) showCfg(true); else { showCfg(false); tick(); }
        });

        const iv = setInterval(tick, 60000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
