"use strict";
window.I18N.register({
    en: { "widget.aws_ec2": "EC2 Instances", "cat.cloud": "Cloud" },
    ru: { "widget.aws_ec2": "EC2 инстансы", "cat.cloud": "Облако" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.aws_ec2 = {
    id: "aws_ec2",
    title: "widget.aws_ec2",
    category: "cloud",
    description: "EC2 instances: id, type, state, Name tag",
    defaultSize: { w: 12, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">🖥 EC2</span><span class="v" id="_e2_sum">…</span></div>
            <div id="_e2_msg" style="color:var(--text-dim);font-size:11px;margin:4px 0"></div>
            <div style="overflow:auto;max-height:100%">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px">NAME</th><th style="padding:2px 6px">ID</th>
                  <th style="padding:2px 6px">TYPE</th><th style="padding:2px 6px">STATE</th>
                  <th style="padding:2px 6px">AZ</th>
                </tr></thead>
                <tbody id="_e2_rows"></tbody>
              </table>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const cwd = () => (window.term ? window.term.lastCwd : undefined);

        const stateColor = st => {
            if (st === "running") return "var(--accent2)";
            if (st === "stopped" || st === "terminated" || st === "stopping") return "var(--text-dim)";
            if (st === "pending" || st === "shutting-down") return "var(--accent)";
            return "var(--text)";
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const r = await window.dyo.exec("aws", ["ec2", "describe-instances", "--output", "json"], { cwd: cwd(), timeout: 15000 });
                if (!alive) return;
                if (!r || r.code !== 0 || !r.stdout.trim()) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n")[0] : "aws CLI not found / not configured";
                    $("#_e2_msg").innerHTML = `<span style="color:var(--danger)">${esc(err)}</span>`;
                    $("#_e2_sum").textContent = "—"; $("#_e2_rows").innerHTML = "";
                    return;
                }
                let j = null;
                try { j = JSON.parse(r.stdout); } catch (e) { j = null; }
                if (!j || !Array.isArray(j.Reservations)) { $("#_e2_msg").innerHTML = `<span style="color:var(--danger)">unparseable response</span>`; return; }
                $("#_e2_msg").textContent = "";
                const inst = [];
                j.Reservations.forEach(res => (res.Instances || []).forEach(i => inst.push(i)));
                if (!inst.length) { $("#_e2_sum").textContent = "no instances"; $("#_e2_rows").innerHTML = ""; return; }
                let running = 0;
                const rows = inst.slice(0, 200).map(i => {
                    const name = ((i.Tags || []).find(t => t.Key === "Name") || {}).Value || "—";
                    const st = (i.State && i.State.Name) || "";
                    if (st === "running") running++;
                    const az = (i.Placement && i.Placement.AvailabilityZone) || "";
                    return `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:2px 6px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(i.InstanceId || "")}</td>
                        <td style="padding:2px 6px">${esc(i.InstanceType || "")}</td>
                        <td style="padding:2px 6px;color:${stateColor(st)}">${esc(st)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(az)}</td></tr>`;
                }).join("");
                $("#_e2_rows").innerHTML = rows;
                $("#_e2_sum").innerHTML = `<b style="color:var(--accent2)">${running} running</b> / ${inst.length} total`;
            } catch (e) {
                if (alive) $("#_e2_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 20000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
