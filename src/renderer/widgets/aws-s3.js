"use strict";
window.I18N.register({
    en: { "widget.aws_s3": "S3 Buckets", "cat.cloud": "Cloud" },
    ru: { "widget.aws_s3": "S3 бакеты", "cat.cloud": "Облако" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.aws_s3 = {
    id: "aws_s3",
    title: "widget.aws_s3",
    category: "cloud",
    description: "S3 buckets with creation date",
    defaultSize: { w: 12, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">🪣 S3</span><span class="v" id="_s3_sum">…</span></div>
            <div id="_s3_msg" style="color:var(--text-dim);font-size:11px;margin:4px 0"></div>
            <div style="overflow:auto;max-height:100%">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px">BUCKET</th><th style="padding:2px 6px">CREATED</th>
                </tr></thead>
                <tbody id="_s3_rows"></tbody>
              </table>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const cwd = () => (window.term ? window.term.lastCwd : undefined);

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const r = await window.dyo.exec("aws", ["s3", "ls"], { cwd: cwd(), timeout: 15000 });
                if (!alive) return;
                if (!r || r.code !== 0) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n")[0] : "aws CLI not found / not configured";
                    $("#_s3_msg").innerHTML = `<span style="color:var(--danger)">${esc(err)}</span>`;
                    $("#_s3_sum").textContent = "—"; $("#_s3_rows").innerHTML = "";
                    return;
                }
                $("#_s3_msg").textContent = "";
                const lines = String(r.stdout || "").split("\n").map(l => l.trim()).filter(Boolean);
                if (!lines.length) { $("#_s3_sum").textContent = "no buckets"; $("#_s3_rows").innerHTML = ""; return; }
                // format: "2024-01-02 15:04:05 bucket-name"
                const rows = lines.slice(0, 200).map(l => {
                    const m = l.match(/^(\S+\s+\S+)\s+(.+)$/);
                    const created = m ? m[1] : "";
                    const name = m ? m[2] : l;
                    return `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:2px 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(created)}</td></tr>`;
                }).join("");
                $("#_s3_rows").innerHTML = rows;
                $("#_s3_sum").innerHTML = `<b style="color:var(--accent2)">${lines.length}</b> bucket${lines.length === 1 ? "" : "s"}`;
            } catch (e) {
                if (alive) $("#_s3_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 30000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
