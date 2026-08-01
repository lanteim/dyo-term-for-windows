"use strict";
window.I18N.register({
    en: { "widget.de_nats": "NATS Server", "cat.data": "Data" },
    ru: { "widget.de_nats": "Сервер NATS", "cat.data": "Данные" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.de_nats = {
    id: "de_nats",
    title: "widget.de_nats",
    category: "data",
    description: "NATS server health from the monitoring endpoint (/varz)",
    defaultSize: { w: 8, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div id="_nt_cfg" style="display:none;flex-direction:column;gap:6px">
              <input id="_nt_url" placeholder="http://localhost:8222" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <button id="_nt_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px">Save</button>
              <div style="color:var(--text-dim);font-size:10.5px">NATS monitoring URL (enable with <code>-m 8222</code>). /varz is queried.</div>
            </div>
            <div id="_nt_main" style="display:none;flex-direction:column;gap:6px;height:100%">
              <div style="display:flex;gap:6px;align-items:center">
                <span id="_nt_dot" style="color:var(--text-dim)">●</span>
                <span id="_nt_name" style="color:var(--accent);font-weight:600">nats</span>
                <span id="_nt_ver" style="color:var(--text-dim)"></span>
                <button id="_nt_edit" title="Edit connection" aria-label="Edit connection" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px;margin-left:auto">⚙</button>
              </div>
              <div id="_nt_grid" style="display:grid;grid-template-columns:1fr 1fr;gap:4px 14px"></div>
              <div id="_nt_meta" style="color:var(--text-dim);font-size:11px;margin-top:auto"></div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, url = "";
        const base = () => url.replace(/\/+$/, "");
        const showCfg = show => { $("#_nt_cfg").style.display = show ? "flex" : "none"; $("#_nt_main").style.display = show ? "none" : "flex"; };
        const fmtUp = s => {
            s = Number(s) || 0;
            const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
            return (d ? d + "d " : "") + (h ? h + "h " : "") + m + "m";
        };
        const row = (k, v) => `<span style="color:var(--text-dim)">${esc(k)}</span><span style="font-family:var(--font-mono);text-align:right">${esc(v)}</span>`;

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            url = (s && s["de.nats.url"]) || "";
            $("#_nt_url").value = url;
            if (!url) showCfg(true); else { showCfg(false); tick(); }
        });

        $("#_nt_save").onclick = async () => {
            url = $("#_nt_url").value.trim();
            await window.dyo.settings.set({ "de.nats.url": url });
            if (url) { showCfg(false); tick(); }
        };
        $("#_nt_edit").onclick = () => showCfg(true);

        const tick = async () => {
            if (!alive || busy || !url) return;
            busy = true;
            $("#_nt_meta").textContent = "polling…";
            try {
                const r = await window.dyo.http(base() + "/varz", { headers: { Accept: "application/json" }, timeout: 8000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_nt_dot").style.color = "var(--danger)";
                    $("#_nt_grid").innerHTML = `<div style="grid-column:1/3;color:var(--danger)">${esc((r && r.error) || ("HTTP " + (r && r.status)))}</div>`;
                    $("#_nt_meta").textContent = "unavailable — is the monitoring port enabled?";
                    return;
                }
                let v; try { v = JSON.parse(r.text); } catch (e) { v = null; }
                if (!v) { $("#_nt_grid").innerHTML = `<div style="grid-column:1/3;color:var(--danger)">unexpected response</div>`; busy = false; return; }
                $("#_nt_dot").style.color = "var(--accent2)";
                $("#_nt_name").textContent = v.server_name || v.server_id || "nats";
                $("#_nt_ver").textContent = v.version ? "v" + v.version : "";
                $("#_nt_grid").innerHTML =
                    row("connections", v.connections != null ? v.connections : "—") +
                    row("total conns", v.total_connections != null ? v.total_connections : "—") +
                    row("subscriptions", v.subscriptions != null ? v.subscriptions : "—") +
                    row("slow consumers", v.slow_consumers != null ? v.slow_consumers : "—") +
                    row("in msgs", v.in_msgs != null ? Number(v.in_msgs).toLocaleString() : "—") +
                    row("out msgs", v.out_msgs != null ? Number(v.out_msgs).toLocaleString() : "—") +
                    row("uptime", v.uptime || (v.uptime_seconds != null ? fmtUp(v.uptime_seconds) : "—")) +
                    row("cpu %", v.cpu != null ? v.cpu : "—");
                $("#_nt_meta").textContent = "updated " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) $("#_nt_grid").innerHTML = `<div style="grid-column:1/3;color:var(--danger)">${esc(e && e.message)}</div>`;
            } finally { busy = false; }
        };

        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
