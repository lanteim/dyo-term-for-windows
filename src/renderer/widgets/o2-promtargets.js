"use strict";
window.I18N.register({
    en: { "widget.o2_promtargets": "Prometheus Targets", "cat.observability": "Observability" },
    ru: { "widget.o2_promtargets": "Prometheus таргеты", "cat.observability": "Наблюдаемость" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.o2_promtargets = {
    id: "o2_promtargets",
    title: "widget.o2_promtargets",
    category: "observability",
    description: "Prometheus scrape targets: up/down counts from /api/v1/targets",
    defaultSize: { w: 9, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px";
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div id="_c" style="display:none;flex-direction:column;gap:6px">
              <input id="_url" placeholder="http://localhost:9090" style="${inp}"/>
              <button id="_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px">Save</button>
            </div>
            <div id="_m" style="display:none;flex-direction:column;gap:6px;height:100%">
              <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">
                <span style="color:#3fb950">UP <b id="_up" style="font-size:16px">0</b></span>
                <span style="color:var(--danger)">DOWN <b id="_dn" style="font-size:16px">0</b></span>
                <span style="color:var(--text-dim)">total <b id="_tot">0</b></span>
              </div>
              <div id="_list" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;font-family:var(--font-mono);font-size:11px"></div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span id="_meta" style="color:var(--text-dim);font-size:11px"></span>
                <button id="_edit" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">⚙</button>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, url = "";
        const base = () => url.replace(/\/+$/, "");
        const showCfg = show => { $("#_c").style.display = show ? "flex" : "none"; $("#_m").style.display = show ? "none" : "flex"; };

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            url = (s && s["o2.prom.url"]) || "";
            $("#_url").value = url;
            if (!url) showCfg(true); else { showCfg(false); tick(); }
        });
        $("#_save").onclick = async () => {
            url = $("#_url").value.trim();
            await window.dyo.settings.set({ "o2.prom.url": url });
            if (url) { showCfg(false); tick(); }
        };
        $("#_edit").onclick = () => showCfg(true);

        const tick = async () => {
            if (!alive || busy || !url) return;
            busy = true; $("#_meta").textContent = "polling…";
            try {
                const r = await window.dyo.http(base() + "/api/v1/targets", { headers: { Accept: "application/json" }, timeout: 8000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_list").innerHTML = `<div style="padding:8px;color:var(--danger)">${esc((r && r.error) || ("HTTP " + (r && r.status)))}</div>`;
                    $("#_meta").textContent = "unavailable"; return;
                }
                let j; try { j = JSON.parse(r.text); } catch (e) { j = null; }
                const arr = j && j.data && Array.isArray(j.data.activeTargets) ? j.data.activeTargets : null;
                if (!arr) { $("#_list").innerHTML = `<div style="padding:8px;color:var(--danger)">unexpected response</div>`; busy = false; return; }
                let up = 0, dn = 0;
                arr.forEach(t => { if (t.health === "up") up++; else dn++; });
                $("#_up").textContent = up; $("#_dn").textContent = dn; $("#_tot").textContent = arr.length;
                const sorted = arr.slice().sort((a, b) => (a.health === "up" ? 1 : 0) - (b.health === "up" ? 1 : 0));
                if (!arr.length) $("#_list").innerHTML = `<div style="padding:8px;color:var(--text-dim)">No targets.</div>`;
                else $("#_list").innerHTML = sorted.slice(0, 200).map(t => {
                    const job = (t.labels && (t.labels.job || t.labels.instance)) || "?";
                    const inst = (t.labels && t.labels.instance) || t.scrapeUrl || "";
                    const c = t.health === "up" ? "#3fb950" : "var(--danger)";
                    return `<div style="display:flex;gap:8px;padding:3px 8px;border-bottom:1px solid var(--border);white-space:nowrap"><span style="color:${c}">●</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis">${esc(job)}</span><span style="color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;max-width:45%">${esc(inst)}</span></div>`;
                }).join("");
                $("#_meta").textContent = "updated " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) $("#_list").innerHTML = `<div style="padding:8px;color:var(--danger)">${esc(e && e.message)}</div>`;
            } finally { busy = false; }
        };
        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
