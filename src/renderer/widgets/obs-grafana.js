"use strict";
window.I18N.register({
    en: { "widget.obs_grafana": "Grafana", "cat.observability": "Observability" },
    ru: { "widget.obs_grafana": "Grafana", "cat.observability": "Наблюдаемость" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.obs_grafana = {
    id: "obs_grafana",
    title: "widget.obs_grafana",
    category: "observability",
    description: "List Grafana dashboards via the search API",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div id="_gf_cfg" style="display:none;flex-direction:column;gap:6px">
              <input id="_gf_url" placeholder="https://grafana.example.com" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <input id="_gf_key" type="password" placeholder="API token (Bearer)" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <button id="_gf_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px">Save</button>
            </div>
            <div id="_gf_main" style="display:none;flex-direction:column;gap:6px;height:100%">
              <div class="metric-row"><span class="k">DASHBOARDS</span><span class="v"><b id="_gf_count" style="font-size:16px">—</b></span></div>
              <div id="_gf_list" style="display:flex;flex-direction:column;gap:2px;overflow:auto;font-family:var(--font-mono);font-size:11px;flex:1"></div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto">
                <span id="_gf_meta" style="color:var(--text-dim);font-size:11px"></span>
                <button id="_gf_edit" title="Settings" aria-label="Settings" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">⚙</button>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        let url = "", key = "";

        const base = () => url.replace(/\/+$/, "");
        const showCfg = show => { $("#_gf_cfg").style.display = show ? "flex" : "none"; $("#_gf_main").style.display = show ? "none" : "flex"; };

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            url = (s && s["obs.grafana.url"]) || "";
            key = (s && s["obs.grafana.key"]) || "";
            $("#_gf_url").value = url;
            $("#_gf_key").value = key;
            if (!url) { showCfg(true); } else { showCfg(false); tick(); }
        });

        $("#_gf_save").onclick = async () => {
            url = $("#_gf_url").value.trim();
            key = $("#_gf_key").value.trim();
            await window.dyo.settings.set({ "obs.grafana.url": url, "obs.grafana.key": key });
            if (url) { showCfg(false); tick(); }
        };
        $("#_gf_edit").onclick = () => showCfg(true);

        const tick = async () => {
            if (!alive || busy || !url) return;
            busy = true;
            $("#_gf_meta").textContent = "polling…";
            try {
                const headers = key ? { Authorization: "Bearer " + key } : {};
                const r = await window.dyo.http(base() + "/api/search?type=dash-db&limit=200", { headers, timeout: 8000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_gf_count").textContent = "—";
                    $("#_gf_list").innerHTML = `<span style="color:var(--danger)">${esc((r && r.error) || ("HTTP " + (r && r.status)))}</span>`;
                    $("#_gf_meta").textContent = "unavailable";
                    return;
                }
                let arr;
                try { arr = JSON.parse(r.text); } catch (e) { arr = null; }
                if (!Array.isArray(arr)) { $("#_gf_list").innerHTML = `<span style="color:var(--danger)">unexpected response</span>`; return; }
                $("#_gf_count").textContent = String(arr.length);
                const list = $("#_gf_list");
                list.innerHTML = "";
                arr.slice(0, 200).forEach(d => {
                    const div = document.createElement("div");
                    div.style.cssText = "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer";
                    const folder = d.folderTitle ? d.folderTitle + " / " : "";
                    div.textContent = "▸ " + folder + (d.title || d.uid || "?");
                    div.title = div.textContent;
                    if (d.url) div.onclick = () => window.dyo.openExternal(base() + d.url);
                    list.appendChild(div);
                });
                if (!arr.length) list.innerHTML = `<span style="color:var(--text-dim)">no dashboards</span>`;
                $("#_gf_meta").textContent = "updated " + new Date().toLocaleTimeString(window.I18N.locale());
            } catch (e) {
                if (alive) { $("#_gf_list").innerHTML = `<span style="color:var(--danger)">${esc(e && e.message)}</span>`; }
            } finally { busy = false; }
        };

        const iv = setInterval(tick, 15000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
