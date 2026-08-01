"use strict";
window.I18N.register({
    en: { "widget.iac_vault": "Vault Status", "cat.iac": "IaC" },
    ru: { "widget.iac_vault": "Статус Vault", "cat.iac": "IaC" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.iac_vault = {
    id: "iac_vault",
    title: "widget.iac_vault",
    category: "iac",
    description: "HashiCorp Vault health via /v1/sys/health: sealed/unsealed, HA, version",
    defaultSize: { w: 7, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div id="_vt_cfg" style="display:none;flex-direction:column;gap:6px">
              <div style="color:var(--text-dim);font-size:11px">Set your Vault address (VAULT_ADDR):</div>
              <input id="_vt_addr" placeholder="https://vault.example.com:8200" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono);font-size:11.5px"/>
              <button id="_vt_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px">Save</button>
            </div>
            <div id="_vt_main" style="display:none;flex-direction:column;gap:6px;height:100%">
              <div style="display:flex;align-items:center;gap:8px">
                <span id="_vt_dot" style="width:12px;height:12px;border-radius:50%;background:var(--text-dim);display:inline-block"></span>
                <b id="_vt_state" style="font-size:15px">…</b>
              </div>
              <div class="metric-row"><span class="k">INITIALIZED</span><span class="v" id="_vt_init">—</span></div>
              <div class="metric-row"><span class="k">HA MODE</span><span class="v" id="_vt_ha">—</span></div>
              <div class="metric-row"><span class="k">VERSION</span><span class="v" id="_vt_ver">—</span></div>
              <div class="metric-row"><span class="k">CLUSTER</span><span class="v" id="_vt_cluster" style="color:var(--text-dim);max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">—</span></div>
              <div id="_vt_msg" style="color:var(--text-dim);font-size:11px"></div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto">
                <span id="_vt_meta" style="color:var(--text-dim);font-size:10.5px"></span>
                <button id="_vt_edit" title="Settings" aria-label="Settings" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">⚙</button>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, addr = "";
        const base = () => addr.replace(/\/+$/, "");
        const showCfg = show => { $("#_vt_cfg").style.display = show ? "flex" : "none"; $("#_vt_main").style.display = show ? "none" : "flex"; };

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            addr = (s && s["iac.vault.addr"]) || "";
            $("#_vt_addr").value = addr;
            if (!addr) showCfg(true); else { showCfg(false); tick(); }
        });

        $("#_vt_save").onclick = async () => {
            addr = $("#_vt_addr").value.trim();
            await window.dyo.settings.set({ "iac.vault.addr": addr });
            if (addr) { showCfg(false); tick(); }
        };
        $("#_vt_edit").onclick = () => showCfg(true);

        const tick = async () => {
            if (!alive || busy || !addr) return;
            busy = true; $("#_vt_meta").textContent = "polling…";
            try {
                // standbyok/perfstandbyok so standby nodes still 200; JSON body returned on all statuses
                const r = await window.dyo.http(base() + "/v1/sys/health?standbyok=true&perfstandbyok=true&sealedcode=200&uninitcode=200", { timeout: 8000 });
                if (!alive) return;
                if (!r || r.error) {
                    $("#_vt_state").textContent = "unreachable";
                    $("#_vt_dot").style.background = "var(--danger)";
                    $("#_vt_msg").innerHTML = `<span style="color:var(--danger)">${esc((r && r.error) || "connection failed")}</span>`;
                    $("#_vt_meta").textContent = "error";
                    return;
                }
                let j = null;
                try { j = JSON.parse(r.text); } catch (e) { j = null; }
                if (!j) {
                    $("#_vt_state").textContent = "HTTP " + r.status;
                    $("#_vt_dot").style.background = "var(--accent)";
                    $("#_vt_msg").innerHTML = `<span style="color:var(--danger)">non-JSON response (is this a Vault API endpoint?)</span>`;
                    return;
                }
                $("#_vt_msg").textContent = "";
                const sealed = !!j.sealed, init = j.initialized !== false, standby = !!j.standby;
                if (!init) {
                    $("#_vt_state").textContent = "UNINITIALIZED";
                    $("#_vt_dot").style.background = "var(--accent)";
                } else if (sealed) {
                    $("#_vt_state").innerHTML = `<span style="color:var(--danger)">SEALED</span>`;
                    $("#_vt_dot").style.background = "var(--danger)";
                } else {
                    $("#_vt_state").innerHTML = `<span style="color:var(--accent2)">UNSEALED</span>`;
                    $("#_vt_dot").style.background = "var(--accent2)";
                }
                $("#_vt_init").textContent = init ? "yes" : "no";
                $("#_vt_ha").textContent = standby ? "standby" : (j.performance_standby ? "perf-standby" : "active");
                $("#_vt_ver").textContent = j.version || "—";
                $("#_vt_cluster").textContent = j.cluster_name || "—";
                $("#_vt_cluster").title = j.cluster_name || "";
                $("#_vt_meta").textContent = "updated " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) $("#_vt_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };

        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
