"use strict";
window.I18N.register({
    en: { "widget.o2_netdata": "Netdata", "cat.observability": "Observability" },
    ru: { "widget.o2_netdata": "Netdata", "cat.observability": "Наблюдаемость" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.o2_netdata = {
    id: "o2_netdata",
    title: "widget.o2_netdata",
    category: "observability",
    description: "Netdata version and alarm counts from /api/v1/info",
    defaultSize: { w: 8, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px";
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div id="_c" style="display:none;flex-direction:column;gap:6px">
              <input id="_url" placeholder="http://localhost:19999" style="${inp}"/>
              <button id="_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px">Save</button>
            </div>
            <div id="_m" style="display:none;flex-direction:column;gap:8px;height:100%">
              <div style="display:flex;align-items:center;gap:10px">
                <span id="_dot" style="font-size:22px;color:var(--text-dim)">●</span>
                <div style="display:flex;flex-direction:column">
                  <b id="_host" style="font-size:14px">—</b>
                  <span id="_ver" style="color:var(--text-dim);font-size:11px"></span>
                </div>
              </div>
              <div style="display:flex;gap:16px;flex-wrap:wrap">
                <span style="color:#3fb950">NORMAL <b id="_n" style="font-size:15px">0</b></span>
                <span style="color:#d29922">WARNING <b id="_w" style="font-size:15px">0</b></span>
                <span style="color:var(--danger)">CRITICAL <b id="_cr" style="font-size:15px">0</b></span>
              </div>
              <div style="flex:1"></div>
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
            url = (s && s["o2.netdata.url"]) || "http://localhost:19999";
            $("#_url").value = url;
            showCfg(false); tick();
        });
        $("#_save").onclick = async () => {
            url = $("#_url").value.trim() || "http://localhost:19999";
            await window.dyo.settings.set({ "o2.netdata.url": url });
            if (url) { showCfg(false); tick(); }
        };
        $("#_edit").onclick = () => showCfg(true);

        const tick = async () => {
            if (!alive || busy || !url) return;
            busy = true; $("#_meta").textContent = "polling…";
            try {
                const r = await window.dyo.http(base() + "/api/v1/info", { headers: { Accept: "application/json" }, timeout: 8000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_dot").style.color = "var(--danger)"; $("#_host").textContent = "unreachable";
                    $("#_ver").textContent = (r && r.error) || ("HTTP " + (r && r.status));
                    $("#_meta").textContent = "unavailable"; return;
                }
                let j; try { j = JSON.parse(r.text); } catch (e) { j = null; }
                if (!j) { $("#_dot").style.color = "var(--danger)"; $("#_host").textContent = "bad response"; busy = false; return; }
                const al = j.alarms || {};
                const n = al.normal || 0, w = al.warning || 0, cr = al.critical || 0;
                $("#_n").textContent = n; $("#_w").textContent = w; $("#_cr").textContent = cr;
                $("#_dot").style.color = cr > 0 ? "var(--danger)" : w > 0 ? "#d29922" : "#3fb950";
                $("#_host").textContent = j.hostname || j.mirrored_hosts && j.mirrored_hosts[0] || "netdata";
                $("#_ver").textContent = "v" + (j.version || "?") + (j.os_name ? " · " + j.os_name : "");
                $("#_meta").textContent = "updated " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) { $("#_dot").style.color = "var(--danger)"; $("#_host").textContent = "error"; $("#_ver").textContent = (e && e.message) || ""; }
            } finally { busy = false; }
        };
        const iv = setInterval(tick, 5000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
