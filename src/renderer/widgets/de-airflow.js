"use strict";
window.I18N.register({
    en: { "widget.de_airflow": "Airflow DAGs", "cat.data": "Data" },
    ru: { "widget.de_airflow": "DAG-и Airflow", "cat.data": "Данные" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.de_airflow = {
    id: "de_airflow",
    title: "widget.de_airflow",
    category: "data",
    description: "Airflow DAGs via the stable REST API (count + paused)",
    defaultSize: { w: 7, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div id="_af_cfg" style="display:none;flex-direction:column;gap:6px">
              <input id="_af_url" placeholder="http://localhost:8080" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <div style="display:flex;gap:6px">
                <input id="_af_user" placeholder="user" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px;flex:1"/>
                <input id="_af_pass" type="password" placeholder="password" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px;flex:1"/>
              </div>
              <button id="_af_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px">Save</button>
            </div>
            <div id="_af_main" style="display:none;flex-direction:column;gap:6px;height:100%">
              <div style="display:flex;gap:14px">
                <div class="metric-row"><span class="k">DAGS</span><span class="v"><b id="_af_total" style="font-size:16px;color:var(--accent2)">—</b></span></div>
                <div class="metric-row"><span class="k">PAUSED</span><span class="v"><b id="_af_paused" style="font-size:16px;color:var(--text-dim)">—</b></span></div>
              </div>
              <div id="_af_list" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;font-family:var(--font-mono);font-size:11px"></div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span id="_af_meta" style="color:var(--text-dim);font-size:11px"></span>
                <button id="_af_edit" title="Edit connection" aria-label="Edit connection" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">⚙</button>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, url = "", user = "", pass = "";
        const base = () => url.replace(/\/+$/, "");
        const showCfg = show => { $("#_af_cfg").style.display = show ? "flex" : "none"; $("#_af_main").style.display = show ? "none" : "flex"; };

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            url = (s && s["de.airflow.url"]) || "";
            user = (s && s["de.airflow.user"]) || "";
            pass = (s && s["de.airflow.pass"]) || "";
            $("#_af_url").value = url; $("#_af_user").value = user; $("#_af_pass").value = pass;
            if (!url) showCfg(true); else { showCfg(false); tick(); }
        });

        $("#_af_save").onclick = async () => {
            url = $("#_af_url").value.trim(); user = $("#_af_user").value.trim(); pass = $("#_af_pass").value;
            await window.dyo.settings.set({ "de.airflow.url": url, "de.airflow.user": user, "de.airflow.pass": pass });
            if (url) { showCfg(false); tick(); }
        };
        $("#_af_edit").onclick = () => showCfg(true);

        const tick = async () => {
            if (!alive || busy || !url) return;
            busy = true;
            $("#_af_meta").textContent = "polling…";
            try {
                const headers = { Accept: "application/json" };
                if (user || pass) headers.Authorization = "Basic " + btoa(user + ":" + pass);
                const r = await window.dyo.http(base() + "/api/v1/dags?limit=200", { headers, timeout: 8000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_af_total").textContent = "—"; $("#_af_paused").textContent = "—";
                    $("#_af_list").innerHTML = `<div style="padding:8px;color:var(--danger)">${esc((r && r.error) || ("HTTP " + (r && r.status)))}</div>`;
                    $("#_af_meta").textContent = "unavailable";
                    return;
                }
                let j; try { j = JSON.parse(r.text); } catch (e) { j = null; }
                const dags = j && Array.isArray(j.dags) ? j.dags : [];
                const total = (j && typeof j.total_entries === "number") ? j.total_entries : dags.length;
                const paused = dags.filter(d => d.is_paused).length;
                $("#_af_total").textContent = String(total);
                $("#_af_paused").textContent = String(paused);
                if (!dags.length) $("#_af_list").innerHTML = `<div style="padding:8px;color:var(--text-dim)">No DAGs.</div>`;
                else $("#_af_list").innerHTML = dags.slice(0, 200).map(d => {
                    const dot = d.is_paused ? "var(--text-dim)" : "var(--accent2)";
                    return `<div style="padding:3px 8px;border-bottom:1px solid var(--border);white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span style="color:${dot}">●</span> ${esc(d.dag_id)}</div>`;
                }).join("");
                $("#_af_meta").textContent = "updated " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) $("#_af_list").innerHTML = `<div style="padding:8px;color:var(--danger)">${esc(e && e.message)}</div>`;
            } finally { busy = false; }
        };

        const iv = setInterval(tick, 15000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
