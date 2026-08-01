"use strict";
window.I18N.register({
    en: { "widget.aws_rds": "RDS Instances", "cat.cloud": "Cloud" },
    ru: { "widget.aws_rds": "RDS инстансы", "cat.cloud": "Облако" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.aws_rds = {
    id: "aws_rds",
    title: "widget.aws_rds",
    category: "cloud",
    description: "RDS DB instances: id, engine, status",
    defaultSize: { w: 12, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">🗄 RDS</span><span class="v" id="_rd_sum">…</span></div>
            <div id="_rd_msg" style="color:var(--text-dim);font-size:11px;margin:4px 0"></div>
            <div style="overflow:auto;max-height:100%">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px">IDENTIFIER</th><th style="padding:2px 6px">ENGINE</th>
                  <th style="padding:2px 6px">CLASS</th><th style="padding:2px 6px">STATUS</th>
                </tr></thead>
                <tbody id="_rd_rows"></tbody>
              </table>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const cwd = () => (window.term ? window.term.lastCwd : undefined);

        const stColor = st => {
            if (st === "available") return "var(--accent2)";
            if (/stopped|deleting|deleted|failed/.test(st)) return "var(--danger)";
            if (/creating|modifying|starting|backing|rebooting|pending/.test(st)) return "var(--accent)";
            return "var(--text)";
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const r = await window.dyo.exec("aws", ["rds", "describe-db-instances", "--output", "json"], { cwd: cwd(), timeout: 15000 });
                if (!alive) return;
                if (!r || r.code !== 0 || !r.stdout.trim()) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n")[0] : "aws CLI not found / not configured";
                    $("#_rd_msg").innerHTML = `<span style="color:var(--danger)">${esc(err)}</span>`;
                    $("#_rd_sum").textContent = "—"; $("#_rd_rows").innerHTML = "";
                    return;
                }
                let j = null;
                try { j = JSON.parse(r.stdout); } catch (e) { j = null; }
                if (!j || !Array.isArray(j.DBInstances)) { $("#_rd_msg").innerHTML = `<span style="color:var(--danger)">unparseable response</span>`; return; }
                $("#_rd_msg").textContent = "";
                const dbs = j.DBInstances;
                if (!dbs.length) { $("#_rd_sum").textContent = "no db instances"; $("#_rd_rows").innerHTML = ""; return; }
                let avail = 0;
                const rows = dbs.slice(0, 200).map(d => {
                    const st = d.DBInstanceStatus || "";
                    if (st === "available") avail++;
                    const eng = (d.Engine || "") + (d.EngineVersion ? " " + d.EngineVersion : "");
                    return `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:2px 6px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.DBInstanceIdentifier || "")}</td>
                        <td style="padding:2px 6px;color:var(--accent)">${esc(eng)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(d.DBInstanceClass || "")}</td>
                        <td style="padding:2px 6px;color:${stColor(st)}">${esc(st)}</td></tr>`;
                }).join("");
                $("#_rd_rows").innerHTML = rows;
                $("#_rd_sum").innerHTML = `<b style="color:var(--accent2)">${avail} available</b> / ${dbs.length} total`;
            } catch (e) {
                if (alive) $("#_rd_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 30000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
