"use strict";
window.I18N.register({
    en: { "widget.obs_pagerduty": "PagerDuty", "cat.observability": "Observability" },
    ru: { "widget.obs_pagerduty": "PagerDuty", "cat.observability": "Наблюдаемость" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.obs_pagerduty = {
    id: "obs_pagerduty",
    title: "widget.obs_pagerduty",
    category: "observability",
    description: "Triggered PagerDuty incidents count and list",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div id="_pd_cfg" style="display:none;flex-direction:column;gap:6px">
              <input id="_pd_token" type="password" placeholder="API token (read-only)" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <button id="_pd_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px">Save</button>
            </div>
            <div id="_pd_main" style="display:none;flex-direction:column;gap:6px;height:100%">
              <div class="metric-row"><span class="k">🚨 TRIGGERED</span><span class="v"><b id="_pd_count" style="font-size:16px">—</b></span></div>
              <div id="_pd_list" style="display:flex;flex-direction:column;gap:2px;overflow:auto;font-family:var(--font-mono);font-size:11px;flex:1"></div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto">
                <span id="_pd_meta" style="color:var(--text-dim);font-size:11px"></span>
                <button id="_pd_edit" title="Settings" aria-label="Settings" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">⚙</button>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        let token = "";

        const showCfg = show => { $("#_pd_cfg").style.display = show ? "flex" : "none"; $("#_pd_main").style.display = show ? "none" : "flex"; };

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            token = (s && s["obs.pd.token"]) || "";
            $("#_pd_token").value = token;
            if (!token) { showCfg(true); } else { showCfg(false); tick(); }
        });

        $("#_pd_save").onclick = async () => {
            token = $("#_pd_token").value.trim();
            await window.dyo.settings.set({ "obs.pd.token": token });
            if (token) { showCfg(false); tick(); }
        };
        $("#_pd_edit").onclick = () => showCfg(true);

        const tick = async () => {
            if (!alive || busy || !token) return;
            busy = true;
            $("#_pd_meta").textContent = "polling…";
            try {
                const ep = "https://api.pagerduty.com/incidents?statuses[]=triggered&limit=100&sort_by=created_at:desc";
                const r = await window.dyo.http(ep, {
                    headers: { Authorization: "Token token=" + token, Accept: "application/vnd.pagerduty+json;version=2" },
                    timeout: 8000
                });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_pd_count").textContent = "—";
                    $("#_pd_list").innerHTML = `<span style="color:var(--danger)">${esc((r && r.error) || ("HTTP " + (r && r.status)))}</span>`;
                    $("#_pd_meta").textContent = "unavailable";
                    return;
                }
                let j;
                try { j = JSON.parse(r.text); } catch (e) { j = null; }
                const arr = (j && j.incidents) || [];
                $("#_pd_count").textContent = String(arr.length);
                $("#_pd_count").style.color = arr.length ? "var(--danger)" : "var(--accent2)";
                const list = $("#_pd_list");
                list.innerHTML = "";
                arr.slice(0, 100).forEach(i => {
                    const div = document.createElement("div");
                    div.style.cssText = "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer";
                    const urg = i.urgency ? " [" + i.urgency + "]" : "";
                    div.textContent = "• #" + (i.incident_number || "?") + " " + (i.title || i.summary || "incident") + urg;
                    div.title = div.textContent;
                    if (i.html_url) div.onclick = () => window.dyo.openExternal(i.html_url);
                    list.appendChild(div);
                });
                if (!arr.length) list.innerHTML = `<span style="color:var(--accent2)">no triggered incidents 🎉</span>`;
                $("#_pd_meta").textContent = "updated " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) { $("#_pd_list").innerHTML = `<span style="color:var(--danger)">${esc(e && e.message)}</span>`; }
            } finally { busy = false; }
        };

        const iv = setInterval(tick, 15000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
