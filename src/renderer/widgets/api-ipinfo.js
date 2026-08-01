"use strict";
window.I18N.register({
    en: { "widget.api_ipinfo": "IP Info", "cat.web": "Web" },
    ru: { "widget.api_ipinfo": "Инфо об IP", "cat.web": "Веб" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.api_ipinfo = {
    id: "api_ipinfo",
    title: "widget.api_ipinfo",
    category: "web",
    description: "Geolocate an IP (or your own) via ip-api.com: city, country, ISP, org",
    defaultSize: { w: 7, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        let alive = true, busy = false;

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <span style="color:var(--accent);font-weight:600">ip-api</span>
              <input id="_ip_in" placeholder="IP or host (blank = your IP)" style="flex:1;min-width:150px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <button id="_ip_go" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 10px;cursor:pointer;font-family:var(--font-mono)">Lookup</button>
              <span id="_ip_st" style="color:var(--text-dim);margin-left:auto"></span>
            </div>
            <div id="_ip_msg" style="color:var(--text-dim);font-size:11px"></div>
            <div id="_ip_out" style="flex:1;overflow:auto"></div>
          </div>`;
        const $ = s => body.querySelector(s);

        const go = async () => {
            if (busy) return; busy = true;
            const q = $("#_ip_in").value.trim();
            $("#_ip_st").textContent = "looking up…"; $("#_ip_msg").textContent = "";
            const url = "http://ip-api.com/json/" + encodeURIComponent(q) + "?fields=status,message,query,city,regionName,country,countryCode,zip,lat,lon,timezone,isp,org,as,reverse,mobile,proxy,hosting";
            try {
                const r = await window.dyo.http(url, { method: "GET", timeout: 12000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) { $("#_ip_msg").innerHTML = `<span style="color:var(--danger)">request failed: ${esc(r && (r.error || r.status))}</span>`; $("#_ip_st").textContent = "failed"; $("#_ip_out").innerHTML = ""; return; }
                const d = JSON.parse(r.text);
                if (d.status !== "success") { $("#_ip_msg").innerHTML = `<span style="color:var(--danger)">${esc(d.message || "lookup failed")}</span>`; $("#_ip_st").textContent = "error"; $("#_ip_out").innerHTML = ""; return; }
                const row = (k, v, c) => v == null || v === "" ? "" : `<div class="metric-row"><span class="k">${esc(k)}</span><span class="v" style="color:${c || "var(--text)"}">${esc(v)}</span></div>`;
                const flags = [d.mobile && "mobile", d.proxy && "proxy/vpn", d.hosting && "hosting/dc"].filter(Boolean).join(" · ");
                $("#_ip_out").innerHTML =
                    row("IP", d.query, "var(--accent2)") +
                    row("CITY", [d.city, d.regionName].filter(Boolean).join(", ")) +
                    row("COUNTRY", [d.country, d.countryCode].filter(Boolean).join(" / ")) +
                    row("ZIP", d.zip) +
                    row("COORDS", (d.lat != null ? d.lat + ", " + d.lon : "")) +
                    row("TZ", d.timezone) +
                    row("ISP", d.isp, "var(--accent)") +
                    row("ORG", d.org) +
                    row("AS", d.as) +
                    row("REVERSE", d.reverse) +
                    (flags ? row("FLAGS", flags, "var(--danger)") : "");
                $("#_ip_st").textContent = "ok";
            } catch (e) { if (alive) $("#_ip_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`; }
            finally { busy = false; }
        };
        $("#_ip_go").onclick = go;
        $("#_ip_in").addEventListener("keydown", e => { if (e.key === "Enter") go(); });
        go();
        return { destroy: () => { alive = false; } };
    }
};
