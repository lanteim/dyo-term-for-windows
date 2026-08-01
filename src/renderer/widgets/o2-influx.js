"use strict";
window.I18N.register({
    en: { "widget.o2_influx": "InfluxDB Health", "cat.observability": "Observability" },
    ru: { "widget.o2_influx": "InfluxDB здоровье", "cat.observability": "Наблюдаемость" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.o2_influx = {
    id: "o2_influx",
    title: "widget.o2_influx",
    category: "observability",
    description: "InfluxDB health status from /health endpoint",
    defaultSize: { w: 8, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px";
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div id="_c" style="display:none;flex-direction:column;gap:6px">
              <input id="_url" placeholder="http://localhost:8086" style="${inp}"/>
              <input id="_tok" type="password" placeholder="token (optional)" style="${inp}"/>
              <input id="_org" placeholder="org (optional)" style="${inp}"/>
              <button id="_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px">Save</button>
            </div>
            <div id="_m" style="display:none;flex-direction:column;gap:8px;height:100%">
              <div style="display:flex;align-items:center;gap:10px">
                <span id="_dot" style="font-size:22px;color:var(--text-dim)">●</span>
                <div style="display:flex;flex-direction:column">
                  <b id="_status" style="font-size:16px">—</b>
                  <span id="_msg" style="color:var(--text-dim);font-size:11px"></span>
                </div>
              </div>
              <div class="metric-row"><span class="k">NAME</span><span class="v" id="_name">—</span></div>
              <div class="metric-row"><span class="k">VERSION</span><span class="v" id="_ver">—</span></div>
              <div style="flex:1"></div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span id="_meta" style="color:var(--text-dim);font-size:11px"></span>
                <button id="_edit" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">⚙</button>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, url = "", tok = "", org = "";
        const base = () => url.replace(/\/+$/, "");
        const showCfg = show => { $("#_c").style.display = show ? "flex" : "none"; $("#_m").style.display = show ? "none" : "flex"; };

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            url = (s && s["o2.influx.url"]) || "";
            tok = (s && s["o2.influx.token"]) || "";
            org = (s && s["o2.influx.org"]) || "";
            $("#_url").value = url; $("#_tok").value = tok; $("#_org").value = org;
            if (!url) showCfg(true); else { showCfg(false); tick(); }
        });
        $("#_save").onclick = async () => {
            url = $("#_url").value.trim(); tok = $("#_tok").value; org = $("#_org").value.trim();
            await window.dyo.settings.set({ "o2.influx.url": url, "o2.influx.token": tok, "o2.influx.org": org });
            if (url) { showCfg(false); tick(); }
        };
        $("#_edit").onclick = () => showCfg(true);

        const tick = async () => {
            if (!alive || busy || !url) return;
            busy = true; $("#_meta").textContent = "polling…";
            try {
                const headers = { Accept: "application/json" };
                if (tok) headers.Authorization = "Token " + tok;
                const r = await window.dyo.http(base() + "/health", { headers, timeout: 8000 });
                if (!alive) return;
                if (!r || r.error) {
                    $("#_dot").style.color = "var(--danger)"; $("#_status").textContent = "unreachable";
                    $("#_msg").textContent = (r && r.error) || "";
                    $("#_meta").textContent = "unavailable"; return;
                }
                let j; try { j = JSON.parse(r.text); } catch (e) { j = null; }
                if (!j) {
                    $("#_dot").style.color = "var(--danger)"; $("#_status").textContent = "HTTP " + r.status;
                    $("#_meta").textContent = "unavailable"; busy = false; return;
                }
                const st = j.status || (r.ok ? "pass" : "fail");
                const ok = st === "pass";
                $("#_dot").style.color = ok ? "#3fb950" : "var(--danger)";
                $("#_status").textContent = st;
                $("#_msg").textContent = j.message || "";
                $("#_name").textContent = j.name || "influxdb";
                $("#_ver").textContent = j.version || (r.headers && r.headers["x-influxdb-version"]) || "—";
                $("#_meta").textContent = "updated " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) { $("#_dot").style.color = "var(--danger)"; $("#_status").textContent = "error"; $("#_msg").textContent = (e && e.message) || ""; }
            } finally { busy = false; }
        };
        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
