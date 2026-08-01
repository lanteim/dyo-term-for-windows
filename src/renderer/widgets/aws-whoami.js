"use strict";
window.I18N.register({
    en: { "widget.aws_whoami": "AWS Identity", "cat.cloud": "Cloud" },
    ru: { "widget.aws_whoami": "AWS кто я", "cat.cloud": "Облако" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.aws_whoami = {
    id: "aws_whoami",
    title: "widget.aws_whoami",
    category: "cloud",
    description: "Caller identity: account, user id, ARN",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div class="metric-row"><span class="k">ACCOUNT</span><span class="v" id="_aw_acct" style="font-family:var(--font-mono);cursor:pointer" title="Click to copy">…</span></div>
              <div class="metric-row"><span class="k">USER ID</span><span class="v" id="_aw_uid" style="max-width:66%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-mono)">—</span></div>
              <div class="metric-row"><span class="k">ARN</span><span class="v" id="_aw_arn" style="max-width:66%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-mono);cursor:pointer" title="Click to copy">—</span></div>
              <div id="_aw_msg" style="color:var(--text-dim);font-size:11px"></div>
              <div style="display:flex;align-items:center;gap:8px;margin-top:auto">
                <button id="_aw_go" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px">Refresh</button>
                <span id="_aw_meta" style="color:var(--text-dim);font-size:11px"></span>
              </div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const cwd = () => (window.term ? window.term.lastCwd : undefined);

        const copy = (el) => { const t = $(el).textContent.trim(); if (t && t !== "…" && t !== "—") navigator.clipboard.writeText(t).catch(() => {}); };
        $("#_aw_acct").onclick = () => copy("#_aw_acct");
        $("#_aw_arn").onclick = () => copy("#_aw_arn");

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            $("#_aw_meta").textContent = "checking…";
            try {
                const r = await window.dyo.exec("aws", ["sts", "get-caller-identity", "--output", "json"], { cwd: cwd(), timeout: 12000 });
                if (!alive) return;
                if (!r || r.code !== 0 || !r.stdout.trim()) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n")[0] : "aws CLI not found / not configured";
                    $("#_aw_msg").innerHTML = `<span style="color:var(--danger)">${esc(err)}</span>`;
                    $("#_aw_acct").textContent = "—"; $("#_aw_uid").textContent = "—"; $("#_aw_arn").textContent = "—";
                    $("#_aw_meta").textContent = "";
                    return;
                }
                let j = null;
                try { j = JSON.parse(r.stdout); } catch (e) { j = null; }
                if (!j) { $("#_aw_msg").innerHTML = `<span style="color:var(--danger)">unparseable response</span>`; $("#_aw_meta").textContent = ""; return; }
                $("#_aw_msg").textContent = "";
                $("#_aw_acct").textContent = j.Account || "—";
                $("#_aw_uid").textContent = j.UserId || "—";
                $("#_aw_uid").title = j.UserId || "";
                $("#_aw_arn").textContent = j.Arn || "—";
                $("#_aw_arn").title = j.Arn || "";
                $("#_aw_meta").textContent = new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) { $("#_aw_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`; $("#_aw_meta").textContent = ""; }
            } finally { busy = false; }
        };
        $("#_aw_go").onclick = tick;
        tick();
        const iv = setInterval(tick, 30000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
