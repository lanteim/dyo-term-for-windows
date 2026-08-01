"use strict";
window.I18N.register({
    en: { "widget.o2_victoria": "VictoriaMetrics", "cat.observability": "Observability" },
    ru: { "widget.o2_victoria": "VictoriaMetrics", "cat.observability": "Наблюдаемость" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.o2_victoria = {
    id: "o2_victoria",
    title: "widget.o2_victoria",
    category: "observability",
    description: "VictoriaMetrics instant query (up) via /api/v1/query",
    defaultSize: { w: 9, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px";
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div id="_c" style="display:none;flex-direction:column;gap:6px">
              <input id="_url" placeholder="http://localhost:8428" style="${inp}"/>
              <input id="_q" placeholder="query (default: up)" style="${inp}"/>
              <button id="_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px">Save</button>
            </div>
            <div id="_m" style="display:none;flex-direction:column;gap:6px;height:100%">
              <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">
                <div class="metric-row"><span class="k">SERIES</span><span class="v"><b id="_cnt" style="font-size:16px;color:var(--accent2)">—</b></span></div>
                <span style="color:var(--text-dim)">query <b id="_qn" style="color:var(--text)"></b></span>
              </div>
              <div id="_list" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;font-family:var(--font-mono);font-size:11px"></div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span id="_meta" style="color:var(--text-dim);font-size:11px"></span>
                <button id="_edit" title="Settings" aria-label="Settings" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">⚙</button>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, url = "", q = "up";
        const base = () => url.replace(/\/+$/, "");
        const showCfg = show => { $("#_c").style.display = show ? "flex" : "none"; $("#_m").style.display = show ? "none" : "flex"; };

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            url = (s && s["o2.vm.url"]) || "";
            q = (s && s["o2.vm.query"]) || "up";
            $("#_url").value = url; $("#_q").value = q === "up" ? "" : q;
            if (!url) showCfg(true); else { showCfg(false); tick(); }
        });
        $("#_save").onclick = async () => {
            url = $("#_url").value.trim();
            q = $("#_q").value.trim() || "up";
            await window.dyo.settings.set({ "o2.vm.url": url, "o2.vm.query": q });
            if (url) { showCfg(false); tick(); }
        };
        $("#_edit").onclick = () => showCfg(true);

        const tick = async () => {
            if (!alive || busy || !url) return;
            busy = true; $("#_meta").textContent = "polling…"; $("#_qn").textContent = q;
            try {
                const r = await window.dyo.http(base() + "/api/v1/query?query=" + encodeURIComponent(q), { headers: { Accept: "application/json" }, timeout: 8000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_cnt").textContent = "—";
                    $("#_list").innerHTML = `<div style="padding:8px;color:var(--danger)">${esc((r && r.error) || ("HTTP " + (r && r.status)))}</div>`;
                    $("#_meta").textContent = "unavailable"; return;
                }
                let j; try { j = JSON.parse(r.text); } catch (e) { j = null; }
                const res = j && j.data && Array.isArray(j.data.result) ? j.data.result : null;
                if (!res) {
                    const em = j && j.error ? j.error : "unexpected response";
                    $("#_list").innerHTML = `<div style="padding:8px;color:var(--danger)">${esc(em)}</div>`; busy = false; return;
                }
                $("#_cnt").textContent = String(res.length);
                if (!res.length) $("#_list").innerHTML = `<div style="padding:8px;color:var(--text-dim)">No series.</div>`;
                else $("#_list").innerHTML = res.slice(0, 200).map(m => {
                    const lbl = m.metric || {};
                    const name = lbl.__name__ || "";
                    const rest = Object.keys(lbl).filter(k => k !== "__name__").map(k => `${k}=${lbl[k]}`).join(",");
                    const val = m.value && m.value.length > 1 ? m.value[1] : "";
                    const vc = val === "1" ? "#3fb950" : val === "0" ? "var(--danger)" : "var(--text)";
                    return `<div style="display:flex;gap:8px;padding:3px 8px;border-bottom:1px solid var(--border);white-space:nowrap"><span style="flex:1;overflow:hidden;text-overflow:ellipsis">${esc(name)}{${esc(rest)}}</span><span style="color:${vc};width:70px;text-align:right">${esc(val)}</span></div>`;
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
