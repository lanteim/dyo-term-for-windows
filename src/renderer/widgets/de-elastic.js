"use strict";
window.I18N.register({
    en: { "widget.de_elastic": "Elasticsearch", "cat.data": "Data" },
    ru: { "widget.de_elastic": "Elasticsearch", "cat.data": "Данные" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.de_elastic = {
    id: "de_elastic",
    title: "widget.de_elastic",
    category: "data",
    description: "Elasticsearch indices (_cat/indices) with health breakdown",
    defaultSize: { w: 9, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div id="_es_cfg" style="display:none;flex-direction:column;gap:6px">
              <input id="_es_url" placeholder="http://localhost:9200" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <div style="display:flex;gap:6px">
                <input id="_es_user" placeholder="user (opt)" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px;flex:1"/>
                <input id="_es_pass" type="password" placeholder="password (opt)" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px;flex:1"/>
              </div>
              <button id="_es_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px">Save</button>
            </div>
            <div id="_es_main" style="display:none;flex-direction:column;gap:6px;height:100%">
              <div style="display:flex;gap:12px;flex-wrap:wrap">
                <div class="metric-row"><span class="k">INDICES</span><span class="v"><b id="_es_cnt" style="font-size:16px;color:var(--accent2)">—</b></span></div>
                <span style="color:#3fb950">● <b id="_es_g">0</b></span>
                <span style="color:#d29922">● <b id="_es_y">0</b></span>
                <span style="color:var(--danger)">● <b id="_es_r">0</b></span>
              </div>
              <div id="_es_list" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;font-family:var(--font-mono);font-size:11px"></div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span id="_es_meta" style="color:var(--text-dim);font-size:11px"></span>
                <button id="_es_edit" title="Edit connection" aria-label="Edit connection" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">⚙</button>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, url = "", user = "", pass = "";
        const base = () => url.replace(/\/+$/, "");
        const showCfg = show => { $("#_es_cfg").style.display = show ? "flex" : "none"; $("#_es_main").style.display = show ? "none" : "flex"; };
        const hc = h => h === "green" ? "#3fb950" : h === "yellow" ? "#d29922" : h === "red" ? "var(--danger)" : "var(--text-dim)";

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            url = (s && s["de.elastic.url"]) || "";
            user = (s && s["de.elastic.user"]) || "";
            pass = (s && s["de.elastic.pass"]) || "";
            $("#_es_url").value = url; $("#_es_user").value = user; $("#_es_pass").value = pass;
            if (!url) showCfg(true); else { showCfg(false); tick(); }
        });

        $("#_es_save").onclick = async () => {
            url = $("#_es_url").value.trim(); user = $("#_es_user").value.trim(); pass = $("#_es_pass").value;
            await window.dyo.settings.set({ "de.elastic.url": url, "de.elastic.user": user, "de.elastic.pass": pass });
            if (url) { showCfg(false); tick(); }
        };
        $("#_es_edit").onclick = () => showCfg(true);

        const tick = async () => {
            if (!alive || busy || !url) return;
            busy = true;
            $("#_es_meta").textContent = "polling…";
            try {
                const headers = { Accept: "application/json" };
                if (user || pass) headers.Authorization = "Basic " + btoa(user + ":" + pass);
                const r = await window.dyo.http(base() + "/_cat/indices?format=json&bytes=b", { headers, timeout: 8000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_es_cnt").textContent = "—";
                    $("#_es_list").innerHTML = `<div style="padding:8px;color:var(--danger)">${esc((r && r.error) || ("HTTP " + (r && r.status)))}</div>`;
                    $("#_es_meta").textContent = "unavailable";
                    return;
                }
                let arr; try { arr = JSON.parse(r.text); } catch (e) { arr = null; }
                if (!Array.isArray(arr)) { $("#_es_list").innerHTML = `<div style="padding:8px;color:var(--danger)">unexpected response</div>`; busy = false; return; }
                let g = 0, y = 0, rd = 0;
                arr.forEach(i => { if (i.health === "green") g++; else if (i.health === "yellow") y++; else if (i.health === "red") rd++; });
                $("#_es_cnt").textContent = String(arr.length);
                $("#_es_g").textContent = g; $("#_es_y").textContent = y; $("#_es_r").textContent = rd;
                const sorted = arr.slice().sort((a, b) => (Number(b["store.size"]) || 0) - (Number(a["store.size"]) || 0));
                if (!arr.length) $("#_es_list").innerHTML = `<div style="padding:8px;color:var(--text-dim)">No indices.</div>`;
                else $("#_es_list").innerHTML = sorted.slice(0, 200).map(i => {
                    const docs = i["docs.count"] || "0";
                    const size = i["store.size"] ? (Number(i["store.size"]) / 1048576).toFixed(1) + "M" : "";
                    return `<div style="display:flex;gap:8px;padding:3px 8px;border-bottom:1px solid var(--border);white-space:nowrap"><span style="color:${hc(i.health)}">●</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis">${esc(i.index)}</span><span style="color:var(--text-dim)">${esc(docs)} docs</span><span style="color:var(--text-dim);width:52px;text-align:right">${esc(size)}</span></div>`;
                }).join("");
                $("#_es_meta").textContent = "updated " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) $("#_es_list").innerHTML = `<div style="padding:8px;color:var(--danger)">${esc(e && e.message)}</div>`;
            } finally { busy = false; }
        };

        const iv = setInterval(tick, 15000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
