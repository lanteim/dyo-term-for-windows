"use strict";
window.I18N.register({
    en: { "widget.aws_alarms": "CloudWatch Alarms", "cat.cloud": "Cloud" },
    ru: { "widget.aws_alarms": "CloudWatch тревоги", "cat.cloud": "Облако" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.aws_alarms = {
    id: "aws_alarms",
    title: "widget.aws_alarms",
    category: "cloud",
    description: "CloudWatch alarms currently in ALARM state",
    defaultSize: { w: 12, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">🚨 ALARMS</span><span class="v" id="_al_sum">…</span></div>
            <div id="_al_msg" style="color:var(--text-dim);font-size:11px;margin:4px 0"></div>
            <div style="overflow:auto;max-height:100%">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px">ALARM</th><th style="padding:2px 6px">METRIC</th>
                  <th style="padding:2px 6px">SINCE</th>
                </tr></thead>
                <tbody id="_al_rows"></tbody>
              </table>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const cwd = () => (window.term ? window.term.lastCwd : undefined);

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const r = await window.dyo.exec("aws", ["cloudwatch", "describe-alarms", "--state-value", "ALARM", "--output", "json"], { cwd: cwd(), timeout: 15000 });
                if (!alive) return;
                if (!r || r.code !== 0 || !r.stdout.trim()) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n")[0] : "aws CLI not found / not configured";
                    $("#_al_msg").innerHTML = `<span style="color:var(--danger)">${esc(err)}</span>`;
                    $("#_al_sum").textContent = "—"; $("#_al_rows").innerHTML = "";
                    return;
                }
                let j = null;
                try { j = JSON.parse(r.stdout); } catch (e) { j = null; }
                if (!j) { $("#_al_msg").innerHTML = `<span style="color:var(--danger)">unparseable response</span>`; return; }
                $("#_al_msg").textContent = "";
                const alarms = (j.MetricAlarms || []).concat(j.CompositeAlarms || []);
                if (!alarms.length) { $("#_al_sum").innerHTML = `<b style="color:var(--accent2)">no firing alarms</b>`; $("#_al_rows").innerHTML = ""; return; }
                const rows = alarms.slice(0, 200).map(a => {
                    const metric = a.MetricName ? (a.Namespace ? a.Namespace + "/" + a.MetricName : a.MetricName) : "(composite)";
                    const since = (a.StateUpdatedTimestamp || "").replace("T", " ").replace(/\.\d+.*$/, "");
                    return `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:2px 6px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--danger)">${esc(a.AlarmName || "")}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(metric)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(since)}</td></tr>`;
                }).join("");
                $("#_al_rows").innerHTML = rows;
                $("#_al_sum").innerHTML = `<b style="color:var(--danger)">${alarms.length} firing</b>`;
            } catch (e) {
                if (alive) $("#_al_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 20000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
