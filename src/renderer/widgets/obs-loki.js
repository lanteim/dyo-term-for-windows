"use strict";
window.I18N.register({
    en: { "widget.obs_loki": "Loki", "cat.observability": "Observability" },
    ru: { "widget.obs_loki": "Loki", "cat.observability": "Наблюдаемость" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.obs_loki = {
    id: "obs_loki",
    title: "widget.obs_loki",
    category: "observability",
    description: "Run a LogQL query and show matching stream count",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div id="_lk_cfg" style="display:none;flex-direction:column;gap:6px">
              <input id="_lk_url" placeholder="http://localhost:3100" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <input id="_lk_query" placeholder='LogQL, e.g. {job="varlogs"}' style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <button id="_lk_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px">Save</button>
            </div>
            <div id="_lk_main" style="display:none;flex-direction:column;gap:6px;height:100%">
              <div class="metric-row"><span class="k">STREAMS</span><span class="v"><b id="_lk_count" style="font-size:16px">—</b></span></div>
              <div class="metric-row"><span class="k">ENTRIES</span><span class="v" id="_lk_entries">—</span></div>
              <div id="_lk_list" style="display:flex;flex-direction:column;gap:2px;overflow:auto;font-family:var(--font-mono);font-size:11px;flex:1"></div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto">
                <span id="_lk_meta" style="color:var(--text-dim);font-size:11px"></span>
                <button id="_lk_edit" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">⚙</button>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        let url = "", query = "";

        const base = () => url.replace(/\/+$/, "");
        const showCfg = show => { $("#_lk_cfg").style.display = show ? "flex" : "none"; $("#_lk_main").style.display = show ? "none" : "flex"; };

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            url = (s && s["obs.loki.url"]) || "";
            query = (s && s["obs.loki.query"]) || "";
            $("#_lk_url").value = url;
            $("#_lk_query").value = query;
            if (!url || !query) { showCfg(true); } else { showCfg(false); tick(); }
        });

        $("#_lk_save").onclick = async () => {
            url = $("#_lk_url").value.trim();
            query = $("#_lk_query").value.trim();
            await window.dyo.settings.set({ "obs.loki.url": url, "obs.loki.query": query });
            if (url && query) { showCfg(false); tick(); }
        };
        $("#_lk_edit").onclick = () => showCfg(true);

        const tick = async () => {
            if (!alive || busy || !url || !query) return;
            busy = true;
            $("#_lk_meta").textContent = "polling…";
            try {
                const r = await window.dyo.http(base() + "/loki/api/v1/query?query=" + encodeURIComponent(query), { timeout: 8000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_lk_count").textContent = "—"; $("#_lk_entries").textContent = "—";
                    $("#_lk_list").innerHTML = `<span style="color:var(--danger)">${esc((r && r.error) || ("HTTP " + (r && r.status)))}</span>`;
                    $("#_lk_meta").textContent = "unavailable";
                    return;
                }
                let j;
                try { j = JSON.parse(r.text); } catch (e) { j = null; }
                if (!j || j.status !== "success") {
                    $("#_lk_list").innerHTML = `<span style="color:var(--danger)">${esc((j && j.error) || "query error")}</span>`;
                    return;
                }
                const result = (j.data && j.data.result) || [];
                let entries = 0;
                result.forEach(s => { entries += (s.values ? s.values.length : (s.value ? 1 : 0)); });
                $("#_lk_count").textContent = String(result.length);
                $("#_lk_entries").textContent = String(entries);
                const list = $("#_lk_list");
                list.innerHTML = "";
                result.slice(0, 100).forEach(s => {
                    const labels = s.stream || s.metric || {};
                    const label = Object.keys(labels).map(k => k + "=" + labels[k]).join(", ");
                    const n = s.values ? s.values.length : 1;
                    const div = document.createElement("div");
                    div.style.cssText = "white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
                    div.textContent = "• {" + label + "} ×" + n;
                    div.title = div.textContent;
                    list.appendChild(div);
                });
                if (!result.length) list.innerHTML = `<span style="color:var(--text-dim)">no matching streams</span>`;
                $("#_lk_meta").textContent = "updated " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) { $("#_lk_list").innerHTML = `<span style="color:var(--danger)">${esc(e && e.message)}</span>`; }
            } finally { busy = false; }
        };

        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
