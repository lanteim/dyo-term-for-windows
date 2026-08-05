"use strict";
window.I18N.register({
    en: { "widget.de_spark": "Spark Apps", "cat.data": "Data" },
    ru: { "widget.de_spark": "Приложения Spark", "cat.data": "Данные" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.de_spark = {
    id: "de_spark",
    title: "widget.de_spark",
    category: "data",
    description: "Spark standalone master apps via /json/ (running + completed)",
    defaultSize: { w: 9, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div id="_sp_cfg" style="display:none;flex-direction:column;gap:6px">
              <input id="_sp_url" placeholder="http://localhost:8080" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <button id="_sp_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px">Save</button>
              <div style="color:var(--text-dim);font-size:10.5px">Spark master Web UI URL (the /json/ endpoint is queried).</div>
            </div>
            <div id="_sp_main" style="display:none;flex-direction:column;gap:6px;height:100%">
              <div style="display:flex;gap:14px;flex-wrap:wrap">
                <div class="metric-row"><span class="k">RUNNING</span><span class="v"><b id="_sp_run" style="font-size:16px;color:var(--accent2)">—</b></span></div>
                <div class="metric-row"><span class="k">WORKERS</span><span class="v"><b id="_sp_wrk" style="font-size:16px">—</b></span></div>
                <div class="metric-row"><span class="k">CORES</span><span class="v"><b id="_sp_cores" style="font-size:16px;color:var(--text-dim)">—</b></span></div>
              </div>
              <div id="_sp_list" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;font-family:var(--font-mono);font-size:11px"></div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span id="_sp_meta" style="color:var(--text-dim);font-size:11px"></span>
                <button id="_sp_edit" title="Edit connection" aria-label="Edit connection" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">⚙</button>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, url = "";
        const base = () => url.replace(/\/+$/, "");
        const showCfg = show => { $("#_sp_cfg").style.display = show ? "flex" : "none"; $("#_sp_main").style.display = show ? "none" : "flex"; };
        const stCol = st => /running/i.test(st) ? "var(--accent2)" : /finished|completed/i.test(st) ? "var(--text-dim)" : "var(--danger)";

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            url = (s && s["de.spark.url"]) || "";
            $("#_sp_url").value = url;
            if (!url) showCfg(true); else { showCfg(false); tick(); }
        });

        $("#_sp_save").onclick = async () => {
            url = $("#_sp_url").value.trim();
            await window.dyo.settings.set({ "de.spark.url": url });
            if (url) { showCfg(false); tick(); }
        };
        $("#_sp_edit").onclick = () => showCfg(true);

        const tick = async () => {
            if (!alive || busy || !url) return;
            busy = true;
            $("#_sp_meta").textContent = "polling…";
            try {
                const r = await window.dyo.http(base() + "/json/", { headers: { Accept: "application/json" }, timeout: 8000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_sp_run").textContent = "—"; $("#_sp_wrk").textContent = "—"; $("#_sp_cores").textContent = "—";
                    $("#_sp_list").innerHTML = `<div style="padding:8px;color:var(--danger)">${esc((r && r.error) || ("HTTP " + (r && r.status)))}</div>`;
                    $("#_sp_meta").textContent = "unavailable";
                    return;
                }
                let j; try { j = JSON.parse(r.text); } catch (e) { j = null; }
                if (!j) { $("#_sp_list").innerHTML = `<div style="padding:8px;color:var(--danger)">unexpected response</div>`; busy = false; return; }
                const apps = Array.isArray(j.activeapps) ? j.activeapps : (Array.isArray(j.apps) ? j.apps : []);
                const completed = Array.isArray(j.completedapps) ? j.completedapps : [];
                const running = apps.filter(a => /running|waiting/i.test(a.state || "")).length;
                $("#_sp_run").textContent = String(running);
                $("#_sp_wrk").textContent = (j.aliveworkers != null ? String(j.aliveworkers) : (Array.isArray(j.workers) ? String(j.workers.length) : "—"));
                $("#_sp_cores").textContent = (j.cores != null ? (j.coresused != null ? j.coresused + "/" + j.cores : String(j.cores)) : "—");
                const all = apps.concat(completed);
                if (!all.length) $("#_sp_list").innerHTML = `<div style="padding:8px;color:var(--text-dim)">No applications.</div>`;
                else $("#_sp_list").innerHTML = all.slice(0, 200).map(a =>
                    `<div style="display:flex;gap:8px;padding:3px 8px;border-bottom:1px solid var(--border);white-space:nowrap"><span style="color:${stCol(a.state)}">●</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis">${esc(a.name || a.id || "?")}</span><span style="color:var(--text-dim);width:70px;text-align:right">${esc(a.cores != null ? a.cores + " cores" : (a.state || ""))}</span></div>`
                ).join("");
                $("#_sp_meta").textContent = "updated " + new Date().toLocaleTimeString(window.I18N.locale());
            } catch (e) {
                if (alive) $("#_sp_list").innerHTML = `<div style="padding:8px;color:var(--danger)">${esc(e && e.message)}</div>`;
            } finally { busy = false; }
        };

        const iv = setInterval(tick, 8000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
