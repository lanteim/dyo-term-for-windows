"use strict";
window.I18N.register({
    en: { "widget.aws_ecs": "ECS Clusters", "cat.cloud": "Cloud" },
    ru: { "widget.aws_ecs": "ECS кластеры", "cat.cloud": "Облако" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.aws_ecs = {
    id: "aws_ecs",
    title: "widget.aws_ecs",
    category: "cloud",
    description: "ECS clusters in the current region",
    defaultSize: { w: 12, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">🐳 ECS</span><span class="v" id="_ec_sum">…</span></div>
            <div id="_ec_msg" style="color:var(--text-dim);font-size:11px;margin:4px 0"></div>
            <div style="overflow:auto;max-height:100%">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px">CLUSTER</th>
                </tr></thead>
                <tbody id="_ec_rows"></tbody>
              </table>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const cwd = () => (window.term ? window.term.lastCwd : undefined);

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const r = await window.dyo.exec("aws", ["ecs", "list-clusters", "--output", "json"], { cwd: cwd(), timeout: 15000 });
                if (!alive) return;
                if (!r || r.code !== 0 || !r.stdout.trim()) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n")[0] : "aws CLI not found / not configured";
                    $("#_ec_msg").innerHTML = `<span style="color:var(--danger)">${esc(err)}</span>`;
                    $("#_ec_sum").textContent = "—"; $("#_ec_rows").innerHTML = "";
                    return;
                }
                let j = null;
                try { j = JSON.parse(r.stdout); } catch (e) { j = null; }
                if (!j || !Array.isArray(j.clusterArns)) { $("#_ec_msg").innerHTML = `<span style="color:var(--danger)">unparseable response</span>`; return; }
                $("#_ec_msg").textContent = "";
                const arns = j.clusterArns;
                if (!arns.length) { $("#_ec_sum").textContent = "no clusters"; $("#_ec_rows").innerHTML = ""; return; }
                const rows = arns.slice(0, 200).map(a => {
                    const name = String(a).split("/").pop() || a;
                    return `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:2px 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(a)}">${esc(name)}</td></tr>`;
                }).join("");
                $("#_ec_rows").innerHTML = rows;
                $("#_ec_sum").innerHTML = `<b style="color:var(--accent2)">${arns.length}</b> cluster${arns.length === 1 ? "" : "s"}`;
            } catch (e) {
                if (alive) $("#_ec_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 30000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
