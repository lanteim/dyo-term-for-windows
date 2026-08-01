"use strict";
window.I18N.register({
    en: { "widget.obs_healthcheck": "Health Check", "cat.observability": "Observability" },
    ru: { "widget.obs_healthcheck": "Проверка здоровья", "cat.observability": "Наблюдаемость" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.obs_healthcheck = {
    id: "obs_healthcheck",
    title: "widget.obs_healthcheck",
    category: "observability",
    description: "Poll one endpoint, verify it returns the expected status",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div id="_hc_cfg" style="display:none;flex-direction:column;gap:6px">
              <input id="_hc_url" placeholder="https://api.example.com/health" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <input id="_hc_expect" placeholder="expected status (default 200)" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <button id="_hc_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px">Save</button>
            </div>
            <div id="_hc_main" style="display:none;flex-direction:column;gap:8px;height:100%">
              <div style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 0">
                <div id="_hc_badge" style="font-size:34px">—</div>
                <div id="_hc_state" style="font-size:15px;font-weight:600">—</div>
              </div>
              <div class="metric-row"><span class="k">STATUS CODE</span><span class="v" id="_hc_code" style="font-variant-numeric:tabular-nums">—</span></div>
              <div class="metric-row"><span class="k">EXPECTED</span><span class="v" id="_hc_exp" style="font-variant-numeric:tabular-nums">—</span></div>
              <div class="metric-row"><span class="k">LATENCY</span><span class="v" id="_hc_lat" style="font-variant-numeric:tabular-nums">—</span></div>
              <div class="metric-row"><span class="k">URL</span><span class="v" id="_hc_url_v" style="max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">—</span></div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto">
                <span id="_hc_meta" style="color:var(--text-dim);font-size:11px"></span>
                <button id="_hc_edit" title="Settings" aria-label="Settings" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">⚙</button>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        let url = "", expect = 200;

        const showCfg = show => { $("#_hc_cfg").style.display = show ? "flex" : "none"; $("#_hc_main").style.display = show ? "none" : "flex"; };

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            url = (s && s["obs.hc.url"]) || "";
            expect = parseInt((s && s["obs.hc.expect"]), 10) || 200;
            $("#_hc_url").value = url;
            $("#_hc_expect").value = String(expect);
            if (!url) { showCfg(true); } else { showCfg(false); tick(); }
        });

        $("#_hc_save").onclick = async () => {
            url = $("#_hc_url").value.trim();
            expect = parseInt($("#_hc_expect").value.trim(), 10) || 200;
            await window.dyo.settings.set({ "obs.hc.url": url, "obs.hc.expect": expect });
            if (url) { showCfg(false); tick(); }
        };
        $("#_hc_edit").onclick = () => showCfg(true);

        const setState = (ok, code, ms, err) => {
            $("#_hc_badge").textContent = ok ? "✅" : "❌";
            $("#_hc_state").textContent = ok ? "HEALTHY" : (err ? "UNREACHABLE" : "UNHEALTHY");
            $("#_hc_state").style.color = ok ? "var(--accent2)" : "var(--danger)";
            $("#_hc_code").textContent = err ? esc(err) : String(code);
            $("#_hc_code").style.color = ok ? "var(--text)" : "var(--danger)";
            $("#_hc_exp").textContent = String(expect);
            $("#_hc_lat").textContent = ms != null ? ms + " ms" : "—";
            $("#_hc_url_v").textContent = url;
            $("#_hc_url_v").title = url;
        };

        const tick = async () => {
            if (!alive || busy || !url) return;
            busy = true;
            $("#_hc_meta").textContent = "checking…";
            const t0 = Date.now();
            try {
                const r = await window.dyo.http(url, { method: "GET", timeout: 8000 });
                if (!alive) return;
                const ms = Date.now() - t0;
                if (!r || r.error) { setState(false, 0, ms, (r && r.error) || "no response"); }
                else { setState(r.status === expect, r.status, ms); }
                $("#_hc_meta").textContent = "updated " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) setState(false, 0, Date.now() - t0, e && e.message);
            } finally { busy = false; }
        };

        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
