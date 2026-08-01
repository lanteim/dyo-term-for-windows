"use strict";
window.I18N.register({
    en: { "widget.gcp_project": "GCP Project", "cat.cloud": "Cloud" },
    ru: { "widget.gcp_project": "Проект GCP", "cat.cloud": "Облако" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.gcp_project = {
    id: "gcp_project",
    title: "widget.gcp_project",
    category: "cloud",
    description: "Active gcloud project, account, region",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">☁ PROJECT</span><span class="v"><b id="_gcpp_proj">…</b></span></div>
            <div class="metric-row"><span class="k">ACCOUNT</span><span class="v" id="_gcpp_acct">…</span></div>
            <div class="metric-row"><span class="k">REGION</span><span class="v" id="_gcpp_reg">…</span></div>
            <div class="metric-row"><span class="k">ZONE</span><span class="v" id="_gcpp_zone">…</span></div>
            <div id="_gcpp_msg" style="color:var(--text-dim);font-size:11px;margin-top:6px"></div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const g = (args) => window.dyo.exec("gcloud", args, { timeout: 12000 });

        const getVal = async (prop) => {
            const r = await g(["config", "get-value", prop, "-q"]);
            if (!r || r.code !== 0) return null;
            const v = (r.stdout || "").trim();
            if (!v || /unset|not set/i.test(v)) return "";
            return v;
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const proj = await getVal("project");
                if (proj === null) {
                    $("#_gcpp_proj").textContent = "—";
                    $("#_gcpp_acct").textContent = "—";
                    $("#_gcpp_reg").textContent = "—";
                    $("#_gcpp_zone").textContent = "—";
                    $("#_gcpp_msg").textContent = "gcloud not found — install Google Cloud SDK to enable";
                    return;
                }
                const [acct, reg, zone] = await Promise.all([
                    getVal("account"), getVal("compute/region"), getVal("compute/zone")
                ]);
                if (!alive) return;
                $("#_gcpp_proj").textContent = proj || "(none set)";
                $("#_gcpp_acct").textContent = acct || "(no account)";
                $("#_gcpp_reg").textContent = reg || "—";
                $("#_gcpp_zone").textContent = zone || "—";
                $("#_gcpp_msg").textContent = proj ? "" : "run: gcloud config set project <ID>";
            } catch (e) {
                $("#_gcpp_msg").textContent = "error: " + esc(e && e.message);
            } finally {
                busy = false;
            }
        };
        tick();
        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
