"use strict";
window.I18N.register({
    en: { "widget.obs_datadog": "Datadog", "cat.observability": "Observability" },
    ru: { "widget.obs_datadog": "Datadog", "cat.observability": "Наблюдаемость" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.obs_datadog = {
    id: "obs_datadog",
    title: "widget.obs_datadog",
    category: "observability",
    description: "Datadog monitors grouped by overall state",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div id="_dd_cfg" style="display:none;flex-direction:column;gap:6px">
              <input id="_dd_api" type="password" placeholder="API key" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <input id="_dd_app" type="password" placeholder="Application key" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <input id="_dd_site" placeholder="site (e.g. datadoghq.com)" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <button id="_dd_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px">Save</button>
            </div>
            <div id="_dd_main" style="display:none;flex-direction:column;gap:6px;height:100%">
              <div class="metric-row"><span class="k">MONITORS</span><span class="v"><b id="_dd_count" style="font-size:16px">—</b></span></div>
              <div id="_dd_states" style="display:flex;flex-direction:column;gap:3px"></div>
              <div id="_dd_list" style="display:flex;flex-direction:column;gap:2px;overflow:auto;font-family:var(--font-mono);font-size:11px;flex:1;margin-top:4px"></div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto">
                <span id="_dd_meta" style="color:var(--text-dim);font-size:11px"></span>
                <button id="_dd_edit" title="Settings" aria-label="Settings" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">⚙</button>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        let apiKey = "", appKey = "", site = "";

        const showCfg = show => { $("#_dd_cfg").style.display = show ? "flex" : "none"; $("#_dd_main").style.display = show ? "none" : "flex"; };
        const stateColor = st => ({ Alert: "var(--danger)", Warn: "#e0a800", "No Data": "var(--text-dim)", OK: "var(--accent2)" }[st] || "var(--text-dim)");

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            apiKey = (s && s["dd.apiKey"]) || "";
            appKey = (s && s["dd.appKey"]) || "";
            site = (s && s["dd.site"]) || "datadoghq.com";
            $("#_dd_api").value = apiKey;
            $("#_dd_app").value = appKey;
            $("#_dd_site").value = site;
            if (!apiKey || !appKey) { showCfg(true); } else { showCfg(false); tick(); }
        });

        $("#_dd_save").onclick = async () => {
            apiKey = $("#_dd_api").value.trim();
            appKey = $("#_dd_app").value.trim();
            site = $("#_dd_site").value.trim() || "datadoghq.com";
            await window.dyo.settings.set({ "dd.apiKey": apiKey, "dd.appKey": appKey, "dd.site": site });
            if (apiKey && appKey) { showCfg(false); tick(); }
        };
        $("#_dd_edit").onclick = () => showCfg(true);

        const tick = async () => {
            if (!alive || busy || !apiKey || !appKey) return;
            busy = true;
            $("#_dd_meta").textContent = "polling…";
            try {
                const ep = "https://api." + site.replace(/^https?:\/\//, "").replace(/\/+$/, "") + "/api/v1/monitor";
                const r = await window.dyo.http(ep, {
                    headers: { "DD-API-KEY": apiKey, "DD-APPLICATION-KEY": appKey },
                    timeout: 8000
                });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_dd_count").textContent = "—"; $("#_dd_states").innerHTML = "";
                    $("#_dd_list").innerHTML = `<span style="color:var(--danger)">${esc((r && r.error) || ("HTTP " + (r && r.status)))}</span>`;
                    $("#_dd_meta").textContent = "unavailable";
                    return;
                }
                let arr;
                try { arr = JSON.parse(r.text); } catch (e) { arr = null; }
                if (!Array.isArray(arr)) { $("#_dd_list").innerHTML = `<span style="color:var(--danger)">unexpected response</span>`; return; }
                $("#_dd_count").textContent = String(arr.length);
                const counts = {};
                arr.forEach(m => { const st = m.overall_state || "Unknown"; counts[st] = (counts[st] || 0) + 1; });
                const sr = $("#_dd_states");
                sr.innerHTML = "";
                Object.keys(counts).sort().forEach(st => {
                    const row = document.createElement("div");
                    row.className = "metric-row";
                    row.innerHTML = `<span class="k" style="color:${stateColor(st)}">${esc(st)}</span><span class="v">${counts[st]}</span>`;
                    sr.appendChild(row);
                });
                const alerting = arr.filter(m => m.overall_state === "Alert" || m.overall_state === "Warn");
                const list = $("#_dd_list");
                list.innerHTML = "";
                alerting.slice(0, 100).forEach(m => {
                    const div = document.createElement("div");
                    div.style.cssText = "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:" + stateColor(m.overall_state);
                    div.textContent = "• " + (m.name || "monitor");
                    div.title = div.textContent;
                    list.appendChild(div);
                });
                if (!alerting.length) list.innerHTML = `<span style="color:var(--accent2)">no alerting monitors 🎉</span>`;
                $("#_dd_meta").textContent = "updated " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) { $("#_dd_list").innerHTML = `<span style="color:var(--danger)">${esc(e && e.message)}</span>`; }
            } finally { busy = false; }
        };

        const iv = setInterval(tick, 15000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
