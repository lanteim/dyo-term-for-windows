"use strict";
window.I18N.register({
    en: { "widget.az_account": "Azure Account", "cat.cloud": "Cloud" },
    ru: { "widget.az_account": "Учётка Azure", "cat.cloud": "Облако" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.az_account = {
    id: "az_account",
    title: "widget.az_account",
    category: "cloud",
    description: "Active Azure subscription name, id, tenant, user",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">☁ SUBSCRIPTION</span><span class="v"><b id="_aza_name">…</b></span></div>
            <div class="metric-row"><span class="k">ID</span><span class="v" id="_aza_id" style="font-variant-numeric:tabular-nums">…</span></div>
            <div class="metric-row"><span class="k">TENANT</span><span class="v" id="_aza_tenant">…</span></div>
            <div class="metric-row"><span class="k">USER</span><span class="v" id="_aza_user">…</span></div>
            <div class="metric-row"><span class="k">STATE</span><span class="v" id="_aza_state">…</span></div>
            <div id="_aza_msg" style="color:var(--text-dim);font-size:11px;margin-top:6px"></div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const r = await window.dyo.exec("az", ["account", "show", "-o", "json"], { timeout: 15000 });
                if (!r || r.code !== 0) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n").filter(Boolean).pop() : "az not found — install Azure CLI to enable";
                    const notLogged = err && /az login|not logged|no subscription/i.test(err);
                    $("#_aza_name").textContent = "—";
                    $("#_aza_id").textContent = "—";
                    $("#_aza_tenant").textContent = "—";
                    $("#_aza_user").textContent = "—";
                    $("#_aza_state").textContent = "—";
                    $("#_aza_msg").textContent = notLogged ? "not logged in — run: az login" : (err || "az CLI unavailable");
                    return;
                }
                let o;
                try { o = JSON.parse(r.stdout || "{}"); } catch (e) { o = {}; }
                if (!alive) return;
                $("#_aza_name").textContent = o.name || "—";
                $("#_aza_id").textContent = o.id || "—";
                $("#_aza_tenant").textContent = o.tenantId || "—";
                $("#_aza_user").textContent = (o.user && o.user.name) ? o.user.name : "—";
                const st = o.state || "";
                const stEl = $("#_aza_state");
                stEl.textContent = st || "—";
                stEl.style.color = /Enabled/i.test(st) ? "var(--accent2)" : "var(--text-dim)";
                $("#_aza_msg").textContent = o.isDefault ? "" : "not the default subscription";
            } catch (e) {
                $("#_aza_msg").textContent = "error: " + esc(e && e.message);
            } finally {
                busy = false;
            }
        };
        tick();
        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
