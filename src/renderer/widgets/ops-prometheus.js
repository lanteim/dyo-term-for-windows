"use strict";
window.I18N.register({
    en: { "widget.prometheus": "Prometheus", "cat.monitoring": "Monitoring" },
    ru: { "widget.prometheus": "Prometheus", "cat.monitoring": "Мониторинг" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.prometheus = {
    id: "prometheus",
    title: "widget.prometheus",
    category: "monitoring",
    description: "Firing alerts count + an instant query result",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
              <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                <input id="_pr_url" placeholder="http://localhost:9090" style="flex:1;min-width:140px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
                <button id="_pr_saveurl" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 9px;cursor:pointer;font-size:11px">Set</button>
              </div>
              <div class="metric-row"><span class="k">🔥 FIRING</span><span class="v"><b id="_pr_alerts" style="font-size:16px">—</b></span></div>
              <div id="_pr_alist" style="display:flex;flex-direction:column;gap:2px;max-height:70px;overflow:auto;font-family:var(--font-mono);font-size:11px"></div>
              <div style="display:flex;gap:6px;align-items:center">
                <input id="_pr_query" placeholder="instant query, e.g. up" style="flex:1;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
                <button id="_pr_saveq" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 9px;cursor:pointer;font-size:11px">Run</button>
              </div>
              <div class="metric-row"><span class="k">RESULT</span><span class="v" id="_pr_qres" style="font-family:var(--font-mono);max-width:65%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">—</span></div>
              <div id="_pr_meta" style="color:var(--text-dim);font-size:11px;margin-top:auto"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        let url = "", query = "";

        const base = () => url.replace(/\/+$/, "");

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            url = (s && s["prom.url"]) || "";
            query = (s && s["prom.query"]) || "";
            $("#_pr_url").value = url;
            $("#_pr_query").value = query;
            tick();
        });

        $("#_pr_saveurl").onclick = async () => {
            url = $("#_pr_url").value.trim();
            await window.dyo.settings.set({ "prom.url": url });
            tick();
        };
        $("#_pr_saveq").onclick = async () => {
            query = $("#_pr_query").value.trim();
            await window.dyo.settings.set({ "prom.query": query });
            runQuery();
        };

        const runQuery = async () => {
            if (!url) return;
            if (!query) { $("#_pr_qres").textContent = "—"; return; }
            try {
                const r = await window.dyo.http(base() + "/api/v1/query?query=" + encodeURIComponent(query), { timeout: 8000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) { $("#_pr_qres").innerHTML = `<span style="color:var(--danger)">${esc((r && r.error) || "query failed")}</span>`; return; }
                const j = JSON.parse(r.text);
                if (j.status !== "success") { $("#_pr_qres").textContent = "error: " + esc(j.error || j.status); return; }
                const res = (j.data && j.data.result) || [];
                if (!res.length) { $("#_pr_qres").textContent = "(empty)"; return; }
                // Show first sample value; note total count
                const first = res[0];
                let val = "";
                if (first.value) val = first.value[1];
                else if (first.values && first.values.length) val = first.values[first.values.length - 1][1];
                $("#_pr_qres").textContent = val + (res.length > 1 ? "  (+" + (res.length - 1) + " series)" : "");
                $("#_pr_qres").title = query;
            } catch (e) {
                if (alive) $("#_pr_qres").textContent = "err: " + esc(e && e.message);
            }
        };

        const loadAlerts = async () => {
            if (!url) return;
            try {
                const r = await window.dyo.http(base() + "/api/v1/alerts", { timeout: 8000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) { $("#_pr_alerts").textContent = "—"; $("#_pr_alerts").style.color = "var(--danger)"; $("#_pr_alist").innerHTML = `<span style="color:var(--danger)">${esc((r && r.error) || ("HTTP " + (r && r.status)))}</span>`; return; }
                const j = JSON.parse(r.text);
                const alerts = (j.data && j.data.alerts) || [];
                const firing = alerts.filter(a => a.state === "firing");
                $("#_pr_alerts").textContent = String(firing.length);
                $("#_pr_alerts").style.color = firing.length ? "var(--danger)" : "var(--accent2)";
                const list = $("#_pr_alist");
                list.innerHTML = "";
                firing.slice(0, 30).forEach(a => {
                    const nm = (a.labels && (a.labels.alertname || a.labels.alert)) || "alert";
                    const sev = (a.labels && a.labels.severity) || "";
                    const div = document.createElement("div");
                    div.style.cssText = "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--danger)";
                    div.textContent = "• " + nm + (sev ? " [" + sev + "]" : "");
                    div.title = nm + " " + sev;
                    list.appendChild(div);
                });
            } catch (e) {
                if (alive) { $("#_pr_alerts").textContent = "—"; $("#_pr_alist").innerHTML = `<span style="color:var(--danger)">${esc(e && e.message)}</span>`; }
            }
        };

        const tick = async () => {
            if (!alive || busy) return;
            if (!url) {
                $("#_pr_alerts").textContent = "—";
                $("#_pr_alist").innerHTML = "";
                $("#_pr_qres").textContent = "—";
                $("#_pr_meta").textContent = "Set a Prometheus base URL to begin.";
                return;
            }
            busy = true;
            $("#_pr_meta").textContent = "polling " + esc(base()) + "…";
            try {
                await Promise.all([loadAlerts(), runQuery()]);
                if (alive) $("#_pr_meta").textContent = "updated " + new Date().toLocaleTimeString();
            } finally { busy = false; }
        };

        const iv = setInterval(tick, 5000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
