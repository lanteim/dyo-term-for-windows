"use strict";
window.I18N.register({
    en: { "widget.ci_ghactions": "GitHub Actions", "cat.cicd": "CI/CD" },
    ru: { "widget.ci_ghactions": "GitHub Actions", "cat.cicd": "CI/CD" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.ci_ghactions = {
    id: "ci_ghactions",
    title: "widget.ci_ghactions",
    category: "cicd",
    description: "Recent GitHub Actions runs via gh CLI (status, branch, conclusion)",
    defaultSize: { w: 12, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">⚙ Actions</span><span class="v" id="_gh_sum">…</span></div>
            <div id="_gh_msg" style="color:var(--text-dim);font-size:11px;margin:4px 0"></div>
            <div style="overflow:auto;max-height:100%">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px"></th><th style="padding:2px 6px">WORKFLOW</th>
                  <th style="padding:2px 6px">BRANCH</th><th style="padding:2px 6px">EVENT</th>
                  <th style="padding:2px 6px">WHEN</th>
                </tr></thead>
                <tbody id="_gh_rows"></tbody>
              </table>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const cwd = () => (window.term ? window.term.lastCwd : undefined);

        const mark = (status, concl) => {
            if (status && status !== "completed") return { g: "◐", c: "var(--accent)", t: status };
            if (concl === "success") return { g: "●", c: "var(--accent2)", t: "success" };
            if (concl === "failure" || concl === "timed_out") return { g: "●", c: "var(--danger)", t: concl };
            if (concl === "cancelled" || concl === "skipped") return { g: "○", c: "var(--text-dim)", t: concl };
            return { g: "○", c: "var(--text-dim)", t: concl || status || "?" };
        };
        const ago = iso => {
            if (!iso) return "";
            const d = (Date.now() - new Date(iso).getTime()) / 1000;
            if (isNaN(d)) return "";
            if (d < 60) return Math.round(d) + "s";
            if (d < 3600) return Math.round(d / 60) + "m";
            if (d < 86400) return Math.round(d / 3600) + "h";
            return Math.round(d / 86400) + "d";
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const r = await window.dyo.exec("gh", ["run", "list", "--limit", "15", "--json", "status,conclusion,name,workflowName,headBranch,event,createdAt,displayTitle,url"], { cwd: cwd(), timeout: 15000 });
                if (!alive) return;
                if (!r || r.code !== 0 || !r.stdout.trim()) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n")[0] : "gh CLI not found — install GitHub CLI & run `gh auth login`";
                    $("#_gh_msg").innerHTML = `<span style="color:var(--danger)">${esc(err)}</span>`;
                    $("#_gh_sum").textContent = "—"; $("#_gh_rows").innerHTML = "";
                    return;
                }
                let arr = null;
                try { arr = JSON.parse(r.stdout); } catch (e) { arr = null; }
                if (!Array.isArray(arr)) { $("#_gh_msg").innerHTML = `<span style="color:var(--danger)">unparseable gh output</span>`; return; }
                $("#_gh_msg").textContent = "";
                if (!arr.length) { $("#_gh_sum").textContent = "no runs"; $("#_gh_rows").innerHTML = ""; return; }
                let ok = 0, fail = 0, run = 0;
                const rows = arr.slice(0, 200).map(x => {
                    const m = mark(x.status, x.conclusion);
                    if (m.t === "success") ok++;
                    else if (x.status && x.status !== "completed") run++;
                    else if (x.conclusion === "failure" || x.conclusion === "timed_out") fail++;
                    const wf = x.workflowName || x.name || x.displayTitle || "";
                    const clk = x.url ? "cursor:pointer" : "";
                    return `<tr data-u="${esc(x.url || "")}" style="border-top:1px solid var(--border);${clk}">
                        <td style="padding:2px 6px;color:${m.c}" title="${esc(m.t)}">${m.g}</td>
                        <td style="padding:2px 6px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(wf)}">${esc(wf)}</td>
                        <td style="padding:2px 6px;color:var(--text-dim);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.headBranch || "")}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(x.event || "")}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(ago(x.createdAt))}</td></tr>`;
                }).join("");
                $("#_gh_rows").innerHTML = rows;
                body.querySelectorAll("#_gh_rows tr").forEach(tr => {
                    const u = tr.getAttribute("data-u");
                    if (u) tr.onclick = () => window.dyo.openExternal(u);
                });
                $("#_gh_sum").innerHTML = `<span style="color:var(--accent2)">${ok}✓</span> <span style="color:var(--danger)">${fail}✗</span> <span style="color:var(--accent)">${run}◐</span> / ${arr.length}`;
            } catch (e) {
                if (alive) $("#_gh_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 15000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
