"use strict";
window.I18N.register({
    en: { "widget.o2_alertmanager": "Alertmanager", "cat.observability": "Observability" },
    ru: { "widget.o2_alertmanager": "Alertmanager", "cat.observability": "Наблюдаемость" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.o2_alertmanager = {
    id: "o2_alertmanager",
    title: "widget.o2_alertmanager",
    category: "observability",
    description: "Alertmanager firing alerts count and list from /api/v2/alerts",
    defaultSize: { w: 9, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px";
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div id="_c" style="display:none;flex-direction:column;gap:6px">
              <input id="_url" placeholder="http://localhost:9093" style="${inp}"/>
              <button id="_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px">Save</button>
            </div>
            <div id="_m" style="display:none;flex-direction:column;gap:6px;height:100%">
              <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">
                <span style="color:var(--danger)">FIRING <b id="_fir" style="font-size:16px">0</b></span>
                <span style="color:#d29922">SUPPRESSED <b id="_sup">0</b></span>
              </div>
              <div id="_list" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;font-family:var(--font-mono);font-size:11px"></div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span id="_meta" style="color:var(--text-dim);font-size:11px"></span>
                <button id="_edit" title="Settings" aria-label="Settings" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">⚙</button>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, url = "";
        const base = () => url.replace(/\/+$/, "");
        const showCfg = show => { $("#_c").style.display = show ? "flex" : "none"; $("#_m").style.display = show ? "none" : "flex"; };
        const sevColor = sv => sv === "critical" ? "var(--danger)" : sv === "warning" ? "#d29922" : "var(--accent2)";

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            url = (s && s["o2.am.url"]) || "";
            $("#_url").value = url;
            if (!url) showCfg(true); else { showCfg(false); tick(); }
        });
        $("#_save").onclick = async () => {
            url = $("#_url").value.trim();
            await window.dyo.settings.set({ "o2.am.url": url });
            if (url) { showCfg(false); tick(); }
        };
        $("#_edit").onclick = () => showCfg(true);

        const tick = async () => {
            if (!alive || busy || !url) return;
            busy = true; $("#_meta").textContent = "polling…";
            try {
                const r = await window.dyo.http(base() + "/api/v2/alerts?active=true&silenced=false&inhibited=false", { headers: { Accept: "application/json" }, timeout: 8000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_list").innerHTML = `<div style="padding:8px;color:var(--danger)">${esc((r && r.error) || ("HTTP " + (r && r.status)))}</div>`;
                    $("#_meta").textContent = "unavailable"; return;
                }
                let arr; try { arr = JSON.parse(r.text); } catch (e) { arr = null; }
                if (!Array.isArray(arr)) { $("#_list").innerHTML = `<div style="padding:8px;color:var(--danger)">unexpected response</div>`; busy = false; return; }
                let fir = 0, sup = 0;
                arr.forEach(a => { const st = a.status && a.status.state; if (st === "suppressed") sup++; else fir++; });
                $("#_fir").textContent = fir; $("#_sup").textContent = sup;
                const sev = a => (a.labels && a.labels.severity) || "";
                const rank = { critical: 0, warning: 1 };
                const sorted = arr.slice().sort((a, b) => (rank[sev(a)] == null ? 2 : rank[sev(a)]) - (rank[sev(b)] == null ? 2 : rank[sev(b)]));
                if (!arr.length) $("#_list").innerHTML = `<div style="padding:8px;color:#3fb950">No active alerts.</div>`;
                else $("#_list").innerHTML = sorted.slice(0, 200).map(a => {
                    const name = (a.labels && a.labels.alertname) || "alert";
                    const sv = sev(a) || "—";
                    const inst = (a.labels && (a.labels.instance || a.labels.namespace)) || "";
                    return `<div style="display:flex;gap:8px;padding:3px 8px;border-bottom:1px solid var(--border);white-space:nowrap"><span style="color:${sevColor(sv)}">●</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis">${esc(name)}</span><span style="color:${sevColor(sv)};width:64px">${esc(sv)}</span><span style="color:var(--text-dim);max-width:35%;overflow:hidden;text-overflow:ellipsis">${esc(inst)}</span></div>`;
                }).join("");
                $("#_meta").textContent = "updated " + new Date().toLocaleTimeString(window.I18N.locale());
            } catch (e) {
                if (alive) $("#_list").innerHTML = `<div style="padding:8px;color:var(--danger)">${esc(e && e.message)}</div>`;
            } finally { busy = false; }
        };
        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
