"use strict";
window.I18N.register({
    en: { "widget.cloudctx": "Cloud Contexts", "cat.devops": "DevOps" },
    ru: { "widget.cloudctx": "Облачные контексты", "cat.devops": "DevOps" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.cloudctx = {
    id: "cloudctx",
    title: "widget.cloudctx",
    category: "devops",
    description: "Active AWS / GCP / Azure contexts",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div class="metric-row"><span class="k">☁ AWS</span><span class="v" id="_cc_aws" style="max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-mono)">…</span></div>
              <div class="metric-row"><span class="k">☁ GCP</span><span class="v" id="_cc_gcp" style="max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-mono)">…</span></div>
              <div class="metric-row"><span class="k">☁ AZURE</span><span class="v" id="_cc_az" style="max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-mono)">…</span></div>
              <div style="display:flex;align-items:center;gap:8px;margin-top:auto">
                <button id="_cc_go" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px">Refresh</button>
                <span id="_cc_meta" style="color:var(--text-dim);font-size:11px"></span>
              </div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const cwd = () => (window.term ? window.term.lastCwd : undefined);
        const ex = (cmd, args) => window.dyo.exec(cmd, args, { cwd: cwd(), timeout: 8000 }).catch(() => null);

        const set = (el, val, ok) => {
            const node = $(el);
            node.style.color = ok ? "var(--accent2)" : "var(--text-dim)";
            node.textContent = val;
        };

        const loadAws = async () => {
            // Prefer explicit AWS_PROFILE, else parse `aws configure list`
            const prof = await ex("printenv", ["AWS_PROFILE"]);
            let profile = (prof && prof.code === 0 && prof.stdout.trim()) ? prof.stdout.trim() : "";
            const region = await ex("printenv", ["AWS_REGION"]).catch(() => null);
            if (profile) {
                const reg = (region && region.code === 0 && region.stdout.trim()) ? region.stdout.trim() : "";
                set("#_cc_aws", profile + (reg ? " · " + reg : ""), true);
                return;
            }
            const cfg = await ex("aws", ["configure", "list"]);
            if (!cfg || cfg.code !== 0 || !cfg.stdout.trim()) { set("#_cc_aws", "not configured", false); return; }
            // Parse the table: rows for profile / region
            let pf = "", rg = "";
            cfg.stdout.split(/\r?\n/).forEach(line => {
                const m = line.trim().split(/\s{2,}/);
                if (/^profile/i.test(line)) pf = (m[1] || "").trim();
                if (/^region/i.test(line)) rg = (m[1] || "").trim();
            });
            if (pf && pf !== "<not") set("#_cc_aws", pf + (rg && rg !== "<not" ? " · " + rg : ""), true);
            else set("#_cc_aws", "default", true);
        };

        const loadGcp = async () => {
            const r = await ex("gcloud", ["config", "get-value", "project"]);
            if (!r || r.code !== 0) { set("#_cc_gcp", "gcloud not found", false); return; }
            const out = r.stdout.trim();
            if (!out || /unset|\(unset\)/i.test(out)) { set("#_cc_gcp", "no project", false); return; }
            set("#_cc_gcp", out.split(/\r?\n/).pop().trim(), true);
        };

        const loadAzure = async () => {
            const r = await ex("az", ["account", "show", "--query", "name", "-o", "tsv"]);
            if (!r || r.code !== 0 || !r.stdout.trim()) { set("#_cc_az", "az not found / logged out", false); return; }
            set("#_cc_az", r.stdout.trim(), true);
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            $("#_cc_meta").textContent = "checking…";
            try {
                await Promise.all([
                    loadAws().catch(() => set("#_cc_aws", "error", false)),
                    loadGcp().catch(() => set("#_cc_gcp", "error", false)),
                    loadAzure().catch(() => set("#_cc_az", "error", false))
                ]);
                if (alive) $("#_cc_meta").textContent = new Date().toLocaleTimeString();
            } finally { busy = false; }
        };
        $("#_cc_go").onclick = tick;
        tick();
        const iv = setInterval(tick, 15000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
