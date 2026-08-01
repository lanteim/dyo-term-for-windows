"use strict";
window.I18N.register({
    en: { "widget.obs_uptime": "Uptime Checks", "cat.observability": "Observability" },
    ru: { "widget.obs_uptime": "Проверки доступности", "cat.observability": "Наблюдаемость" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.obs_uptime = {
    id: "obs_uptime",
    title: "widget.obs_uptime",
    category: "observability",
    description: "Ping a list of URLs: up/down, status code, latency",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div id="_up_cfg" style="display:none;flex-direction:column;gap:6px">
              <textarea id="_up_urls" placeholder="One URL per line&#10;https://example.com&#10;https://api.example.com/health" style="min-height:80px;resize:vertical;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"></textarea>
              <button id="_up_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px">Save</button>
            </div>
            <div id="_up_main" style="display:none;flex-direction:column;gap:6px;height:100%">
              <div class="metric-row"><span class="k">STATUS</span><span class="v"><b id="_up_summary" style="font-size:14px">—</b></span></div>
              <div id="_up_list" style="display:flex;flex-direction:column;gap:3px;overflow:auto;font-family:var(--font-mono);font-size:11px;flex:1"></div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto">
                <span id="_up_meta" style="color:var(--text-dim);font-size:11px"></span>
                <button id="_up_edit" title="Settings" aria-label="Settings" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">⚙</button>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        let urls = [];

        const showCfg = show => { $("#_up_cfg").style.display = show ? "flex" : "none"; $("#_up_main").style.display = show ? "none" : "flex"; };

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            const raw = s && s["obs.uptime.urls"];
            urls = Array.isArray(raw) ? raw : (raw ? String(raw).split("\n") : []);
            urls = urls.map(u => u.trim()).filter(Boolean);
            $("#_up_urls").value = urls.join("\n");
            if (!urls.length) { showCfg(true); } else { showCfg(false); tick(); }
        });

        $("#_up_save").onclick = async () => {
            urls = $("#_up_urls").value.split("\n").map(u => u.trim()).filter(Boolean);
            await window.dyo.settings.set({ "obs.uptime.urls": urls });
            if (urls.length) { showCfg(false); tick(); }
        };
        $("#_up_edit").onclick = () => showCfg(true);

        const check = async (u) => {
            const t0 = Date.now();
            try {
                const r = await window.dyo.http(u, { method: "GET", timeout: 8000 });
                const ms = Date.now() - t0;
                if (!r || r.error) return { url: u, up: false, code: 0, ms, err: (r && r.error) || "no response" };
                return { url: u, up: !!r.ok, code: r.status, ms };
            } catch (e) {
                return { url: u, up: false, code: 0, ms: Date.now() - t0, err: e && e.message };
            }
        };

        const tick = async () => {
            if (!alive || busy || !urls.length) return;
            busy = true;
            $("#_up_meta").textContent = "checking…";
            try {
                const results = await Promise.all(urls.map(check));
                if (!alive) return;
                const upCount = results.filter(r => r.up).length;
                $("#_up_summary").textContent = upCount + " / " + results.length + " up";
                $("#_up_summary").style.color = upCount === results.length ? "var(--accent2)" : "var(--danger)";
                const list = $("#_up_list");
                list.innerHTML = "";
                results.forEach(r => {
                    const row = document.createElement("div");
                    row.style.cssText = "display:flex;gap:6px;align-items:center;white-space:nowrap;overflow:hidden";
                    const dot = r.up ? "🟢" : "🔴";
                    const info = r.up ? (r.code + " · " + r.ms + "ms") : (r.err ? "err" : (r.code + " · " + r.ms + "ms"));
                    row.innerHTML = `<span>${dot}</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis" title="${esc(r.url)}${r.err ? " — " + esc(r.err) : ""}">${esc(r.url)}</span><span style="color:${r.up ? "var(--text-dim)" : "var(--danger)"};font-variant-numeric:tabular-nums">${esc(info)}</span>`;
                    list.appendChild(row);
                });
                $("#_up_meta").textContent = "updated " + new Date().toLocaleTimeString();
            } finally { busy = false; }
        };

        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
