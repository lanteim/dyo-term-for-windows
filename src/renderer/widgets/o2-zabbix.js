"use strict";
window.I18N.register({
    en: { "widget.o2_zabbix": "Zabbix Problems", "cat.observability": "Observability" },
    ru: { "widget.o2_zabbix": "Zabbix проблемы", "cat.observability": "Наблюдаемость" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.o2_zabbix = {
    id: "o2_zabbix",
    title: "widget.o2_zabbix",
    category: "observability",
    description: "Zabbix active problems via JSON-RPC problem.get",
    defaultSize: { w: 9, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px";
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div id="_c" style="display:none;flex-direction:column;gap:6px">
              <input id="_url" placeholder="http://zabbix.local (base or /api_jsonrpc.php)" style="${inp}"/>
              <input id="_tok" type="password" placeholder="API token" style="${inp}"/>
              <button id="_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px">Save</button>
            </div>
            <div id="_m" style="display:none;flex-direction:column;gap:6px;height:100%">
              <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">
                <span style="color:var(--danger)">PROBLEMS <b id="_cnt" style="font-size:16px">0</b></span>
                <span style="color:#d29922">high+ <b id="_hi">0</b></span>
              </div>
              <div id="_list" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;font-family:var(--font-mono);font-size:11px"></div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span id="_meta" style="color:var(--text-dim);font-size:11px"></span>
                <button id="_edit" title="Settings" aria-label="Settings" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">⚙</button>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, url = "", tok = "";
        const endpoint = () => {
            const b = url.replace(/\/+$/, "");
            return /api_jsonrpc\.php$/.test(b) ? b : b + "/api_jsonrpc.php";
        };
        const showCfg = show => { $("#_c").style.display = show ? "flex" : "none"; $("#_m").style.display = show ? "none" : "flex"; };
        const SEV = { "0": ["not classified", "var(--text-dim)"], "1": ["information", "var(--accent2)"], "2": ["warning", "#d29922"], "3": ["average", "#e0873a"], "4": ["high", "#f0883e"], "5": ["disaster", "var(--danger)"] };

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            url = (s && s["o2.zabbix.url"]) || "";
            tok = (s && s["o2.zabbix.token"]) || "";
            $("#_url").value = url; $("#_tok").value = tok;
            if (!url || !tok) showCfg(true); else { showCfg(false); tick(); }
        });
        $("#_save").onclick = async () => {
            url = $("#_url").value.trim(); tok = $("#_tok").value.trim();
            await window.dyo.settings.set({ "o2.zabbix.url": url, "o2.zabbix.token": tok });
            if (url && tok) { showCfg(false); tick(); }
        };
        $("#_edit").onclick = () => showCfg(true);

        const tick = async () => {
            if (!alive || busy || !url || !tok) return;
            busy = true; $("#_meta").textContent = "polling…";
            try {
                const payload = { jsonrpc: "2.0", method: "problem.get", params: { output: "extend", recent: false, sortfield: ["eventid"], sortorder: "DESC", limit: 200 }, id: 1 };
                const r = await window.dyo.http(endpoint(), {
                    method: "POST",
                    headers: { "Content-Type": "application/json-rpc", Accept: "application/json", Authorization: "Bearer " + tok },
                    body: JSON.stringify(payload),
                    timeout: 9000
                });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_list").innerHTML = `<div style="padding:8px;color:var(--danger)">${esc((r && r.error) || ("HTTP " + (r && r.status)))}</div>`;
                    $("#_meta").textContent = "unavailable"; return;
                }
                let j; try { j = JSON.parse(r.text); } catch (e) { j = null; }
                if (j && j.error) { $("#_list").innerHTML = `<div style="padding:8px;color:var(--danger)">${esc(j.error.data || j.error.message || "API error")}</div>`; busy = false; return; }
                const arr = j && Array.isArray(j.result) ? j.result : null;
                if (!arr) { $("#_list").innerHTML = `<div style="padding:8px;color:var(--danger)">unexpected response</div>`; busy = false; return; }
                let hi = 0;
                arr.forEach(p => { if (Number(p.severity) >= 4) hi++; });
                $("#_cnt").textContent = arr.length; $("#_hi").textContent = hi;
                const sorted = arr.slice().sort((a, b) => Number(b.severity) - Number(a.severity));
                if (!arr.length) $("#_list").innerHTML = `<div style="padding:8px;color:#3fb950">No active problems.</div>`;
                else $("#_list").innerHTML = sorted.slice(0, 200).map(p => {
                    const sv = SEV[String(p.severity)] || ["?", "var(--text-dim)"];
                    const t = p.clock ? new Date(Number(p.clock) * 1000).toLocaleString(window.I18N.locale()) : "";
                    return `<div style="display:flex;gap:8px;padding:3px 8px;border-bottom:1px solid var(--border);white-space:nowrap"><span style="color:${sv[1]}">●</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</span><span style="color:${sv[1]};width:70px">${esc(sv[0])}</span><span style="color:var(--text-dim);font-size:10px">${esc(t)}</span></div>`;
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
