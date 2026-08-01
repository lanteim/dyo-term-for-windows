"use strict";
window.I18N.register({
    en: { "widget.obs_sentry": "Sentry", "cat.observability": "Observability" },
    ru: { "widget.obs_sentry": "Sentry", "cat.observability": "Наблюдаемость" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.obs_sentry = {
    id: "obs_sentry",
    title: "widget.obs_sentry",
    category: "observability",
    description: "Unresolved Sentry issues count and titles",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div id="_st_cfg" style="display:none;flex-direction:column;gap:6px">
              <input id="_st_url" placeholder="https://sentry.io (or self-hosted)" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <input id="_st_token" type="password" placeholder="Auth token" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <input id="_st_org" placeholder="org slug" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <input id="_st_project" placeholder="project slug" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <button id="_st_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px">Save</button>
            </div>
            <div id="_st_main" style="display:none;flex-direction:column;gap:6px;height:100%">
              <div class="metric-row"><span class="k">UNRESOLVED</span><span class="v"><b id="_st_count" style="font-size:16px">—</b></span></div>
              <div id="_st_list" style="display:flex;flex-direction:column;gap:2px;overflow:auto;font-family:var(--font-mono);font-size:11px;flex:1"></div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto">
                <span id="_st_meta" style="color:var(--text-dim);font-size:11px"></span>
                <button id="_st_edit" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">⚙</button>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        let url = "", token = "", org = "", project = "";

        const base = () => url.replace(/\/+$/, "");
        const showCfg = show => { $("#_st_cfg").style.display = show ? "flex" : "none"; $("#_st_main").style.display = show ? "none" : "flex"; };

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            url = (s && s["obs.sentry.url"]) || "https://sentry.io";
            token = (s && s["obs.sentry.token"]) || "";
            org = (s && s["obs.sentry.org"]) || "";
            project = (s && s["obs.sentry.project"]) || "";
            $("#_st_url").value = url;
            $("#_st_token").value = token;
            $("#_st_org").value = org;
            $("#_st_project").value = project;
            if (!token || !org || !project) { showCfg(true); } else { showCfg(false); tick(); }
        });

        $("#_st_save").onclick = async () => {
            url = $("#_st_url").value.trim() || "https://sentry.io";
            token = $("#_st_token").value.trim();
            org = $("#_st_org").value.trim();
            project = $("#_st_project").value.trim();
            await window.dyo.settings.set({ "obs.sentry.url": url, "obs.sentry.token": token, "obs.sentry.org": org, "obs.sentry.project": project });
            if (token && org && project) { showCfg(false); tick(); }
        };
        $("#_st_edit").onclick = () => showCfg(true);

        const tick = async () => {
            if (!alive || busy || !token || !org || !project) return;
            busy = true;
            $("#_st_meta").textContent = "polling…";
            try {
                const ep = base() + "/api/0/projects/" + encodeURIComponent(org) + "/" + encodeURIComponent(project) + "/issues/?query=is:unresolved&statsPeriod=24h";
                const r = await window.dyo.http(ep, { headers: { Authorization: "Bearer " + token }, timeout: 8000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_st_count").textContent = "—";
                    $("#_st_list").innerHTML = `<span style="color:var(--danger)">${esc((r && r.error) || ("HTTP " + (r && r.status)))}</span>`;
                    $("#_st_meta").textContent = "unavailable";
                    return;
                }
                let arr;
                try { arr = JSON.parse(r.text); } catch (e) { arr = null; }
                if (!Array.isArray(arr)) { $("#_st_list").innerHTML = `<span style="color:var(--danger)">unexpected response</span>`; return; }
                $("#_st_count").textContent = String(arr.length);
                $("#_st_count").style.color = arr.length ? "var(--danger)" : "var(--accent2)";
                const list = $("#_st_list");
                list.innerHTML = "";
                arr.slice(0, 100).forEach(i => {
                    const div = document.createElement("div");
                    div.style.cssText = "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer";
                    const cnt = i.count != null ? " (" + i.count + ")" : "";
                    div.textContent = "• " + (i.title || i.culprit || i.shortId || "issue") + cnt;
                    div.title = div.textContent;
                    if (i.permalink) div.onclick = () => window.dyo.openExternal(i.permalink);
                    list.appendChild(div);
                });
                if (!arr.length) list.innerHTML = `<span style="color:var(--accent2)">no unresolved issues 🎉</span>`;
                $("#_st_meta").textContent = "updated " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) { $("#_st_list").innerHTML = `<span style="color:var(--danger)">${esc(e && e.message)}</span>`; }
            } finally { busy = false; }
        };

        const iv = setInterval(tick, 15000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
