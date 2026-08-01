"use strict";
window.I18N.register({
    en: { "widget.aws_regionprofile": "AWS Region / Profile", "cat.cloud": "Cloud" },
    ru: { "widget.aws_regionprofile": "AWS регион / профиль", "cat.cloud": "Облако" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.aws_regionprofile = {
    id: "aws_regionprofile",
    title: "widget.aws_regionprofile",
    category: "cloud",
    description: "Active AWS_PROFILE / AWS_REGION and configure list",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div class="metric-row"><span class="k">PROFILE</span><span class="v" id="_rp_prof" style="font-family:var(--font-mono)">…</span></div>
              <div class="metric-row"><span class="k">REGION</span><span class="v" id="_rp_reg" style="font-family:var(--font-mono)">…</span></div>
              <div class="metric-row"><span class="k">CREDS</span><span class="v" id="_rp_cred" style="font-family:var(--font-mono);color:var(--text-dim)">—</span></div>
              <div id="_rp_msg" style="color:var(--text-dim);font-size:11px"></div>
              <div style="display:flex;align-items:center;gap:8px;margin-top:auto">
                <button id="_rp_go" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px">Refresh</button>
                <span id="_rp_meta" style="color:var(--text-dim);font-size:11px"></span>
              </div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const cwd = () => (window.term ? window.term.lastCwd : undefined);
        const ex = (cmd, args) => window.dyo.exec(cmd, args, { cwd: cwd(), timeout: 10000 }).catch(() => null);

        const parseConfigLine = (out, key) => {
            let val = "";
            out.split(/\r?\n/).forEach(line => {
                if (new RegExp("^\\s*" + key + "\\b", "i").test(line)) {
                    const cols = line.trim().split(/\s{2,}/);
                    val = (cols[1] || "").trim();
                }
            });
            return val;
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            $("#_rp_meta").textContent = "checking…";
            try {
                const envP = await ex("printenv", ["AWS_PROFILE"]);
                const envR = await ex("printenv", ["AWS_REGION"]);
                if (!alive) return;
                let profile = (envP && envP.code === 0) ? envP.stdout.trim() : "";
                let region = (envR && envR.code === 0) ? envR.stdout.trim() : "";
                let creds = "";

                const cfg = await ex("aws", ["configure", "list"]);
                if (!alive) return;
                if (!cfg) {
                    $("#_rp_msg").innerHTML = `<span style="color:var(--danger)">aws CLI not found / not configured</span>`;
                } else if (cfg.code !== 0 || !cfg.stdout.trim()) {
                    const err = cfg.stderr ? cfg.stderr.trim().split("\n")[0] : "aws configure list failed";
                    $("#_rp_msg").innerHTML = `<span style="color:var(--danger)">${esc(err)}</span>`;
                } else {
                    $("#_rp_msg").textContent = "";
                    const clean = v => (!v || v === "<not" || v === "<not_set>") ? "" : v;
                    if (!profile) profile = clean(parseConfigLine(cfg.stdout, "profile"));
                    if (!region) region = clean(parseConfigLine(cfg.stdout, "region"));
                    creds = clean(parseConfigLine(cfg.stdout, "access_key")) ? "configured" : "not set";
                }

                $("#_rp_prof").textContent = profile || "default";
                $("#_rp_prof").style.color = profile ? "var(--accent2)" : "var(--text-dim)";
                $("#_rp_reg").textContent = region || "—";
                $("#_rp_reg").style.color = region ? "var(--accent)" : "var(--text-dim)";
                $("#_rp_cred").textContent = creds || "—";
                $("#_rp_cred").style.color = creds === "configured" ? "var(--accent2)" : "var(--text-dim)";
                $("#_rp_meta").textContent = new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) { $("#_rp_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`; $("#_rp_meta").textContent = ""; }
            } finally { busy = false; }
        };
        $("#_rp_go").onclick = tick;
        tick();
        const iv = setInterval(tick, 15000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
