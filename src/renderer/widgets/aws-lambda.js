"use strict";
window.I18N.register({
    en: { "widget.aws_lambda": "Lambda Functions", "cat.cloud": "Cloud" },
    ru: { "widget.aws_lambda": "Lambda функции", "cat.cloud": "Облако" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.aws_lambda = {
    id: "aws_lambda",
    title: "widget.aws_lambda",
    category: "cloud",
    description: "Lambda functions: name, runtime, memory",
    defaultSize: { w: 12, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">λ LAMBDA</span><span class="v" id="_lm_sum">…</span></div>
            <div id="_lm_msg" style="color:var(--text-dim);font-size:11px;margin:4px 0"></div>
            <div style="overflow:auto;max-height:100%">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px">NAME</th><th style="padding:2px 6px">RUNTIME</th>
                  <th style="padding:2px 6px">MEM</th><th style="padding:2px 6px">MODIFIED</th>
                </tr></thead>
                <tbody id="_lm_rows"></tbody>
              </table>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const cwd = () => (window.term ? window.term.lastCwd : undefined);

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const r = await window.dyo.exec("aws", ["lambda", "list-functions", "--output", "json"], { cwd: cwd(), timeout: 15000 });
                if (!alive) return;
                if (!r || r.code !== 0 || !r.stdout.trim()) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n")[0] : "aws CLI not found / not configured";
                    $("#_lm_msg").innerHTML = `<span style="color:var(--danger)">${esc(err)}</span>`;
                    $("#_lm_sum").textContent = "—"; $("#_lm_rows").innerHTML = "";
                    return;
                }
                let j = null;
                try { j = JSON.parse(r.stdout); } catch (e) { j = null; }
                if (!j || !Array.isArray(j.Functions)) { $("#_lm_msg").innerHTML = `<span style="color:var(--danger)">unparseable response</span>`; return; }
                $("#_lm_msg").textContent = "";
                const fns = j.Functions;
                if (!fns.length) { $("#_lm_sum").textContent = "no functions"; $("#_lm_rows").innerHTML = ""; return; }
                const rows = fns.slice(0, 200).map(f => {
                    const mod = (f.LastModified || "").replace("T", " ").replace(/\.\d+.*$/, "");
                    return `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:2px 6px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.FunctionName || "")}</td>
                        <td style="padding:2px 6px;color:var(--accent)">${esc(f.Runtime || "—")}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(String(f.MemorySize || ""))}${f.MemorySize ? "M" : ""}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(mod)}</td></tr>`;
                }).join("");
                $("#_lm_rows").innerHTML = rows;
                $("#_lm_sum").innerHTML = `<b style="color:var(--accent2)">${fns.length}</b> function${fns.length === 1 ? "" : "s"}`;
            } catch (e) {
                if (alive) $("#_lm_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 30000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
