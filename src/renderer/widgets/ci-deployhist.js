"use strict";
window.I18N.register({
    en: { "widget.ci_deployhist": "Deploy History", "cat.cicd": "CI/CD" },
    ru: { "widget.ci_deployhist": "История деплоев", "cat.cicd": "CI/CD" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.ci_deployhist = {
    id: "ci_deployhist",
    title: "widget.ci_deployhist",
    category: "cicd",
    description: "Recent git tags (releases/deploys) with dates & authors from cwd",
    defaultSize: { w: 8, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">🏷 Deploys / Tags</span><span class="v" id="_dh_sum">…</span></div>
            <div id="_dh_msg" style="color:var(--text-dim);font-size:11px;margin:4px 0"></div>
            <div style="overflow:auto;max-height:100%">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px">TAG</th><th style="padding:2px 6px">DATE</th>
                  <th style="padding:2px 6px">AUTHOR</th><th style="padding:2px 6px">SUBJECT</th>
                </tr></thead>
                <tbody id="_dh_rows"></tbody>
              </table>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const git = args => window.dyo.exec("git", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 6000 });

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const inside = await git(["rev-parse", "--is-inside-work-tree"]);
                if (!alive) return;
                if (!inside || inside.code !== 0 || inside.stdout.trim() !== "true") {
                    $("#_dh_msg").innerHTML = `<span style="color:var(--text-dim)">not a git repository (open a repo in the focused terminal)</span>`;
                    $("#_dh_sum").textContent = "—"; $("#_dh_rows").innerHTML = "";
                    return;
                }
                // Tags sorted by creation date; format is delimited by \x1f, rows by newline.
                const fmt = "%(refname:short)\x1f%(creatordate:short)\x1f%(*authorname)%(authorname)\x1f%(contents:subject)";
                const r = await git(["for-each-ref", "--sort=-creatordate", "--count=50", "--format=" + fmt, "refs/tags"]);
                if (!alive) return;
                if (!r || r.code !== 0) {
                    $("#_dh_msg").innerHTML = `<span style="color:var(--danger)">${esc((r && r.stderr && r.stderr.trim().split("\n")[0]) || "git failed")}</span>`;
                    return;
                }
                const lines = r.stdout.split("\n").filter(l => l.trim());
                if (!lines.length) {
                    $("#_dh_msg").innerHTML = `<span style="color:var(--text-dim)">no tags in this repo</span>`;
                    $("#_dh_sum").textContent = "0"; $("#_dh_rows").innerHTML = "";
                    return;
                }
                $("#_dh_msg").textContent = "";
                $("#_dh_sum").innerHTML = `<b style="color:var(--accent2)">${lines.length}</b> tags`;
                $("#_dh_rows").innerHTML = lines.slice(0, 200).map(l => {
                    const p = l.split("\x1f");
                    return `<tr style="border-top:1px solid var(--border)">
                        <td style="padding:2px 6px;color:var(--accent);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(p[0])}">${esc(p[0] || "")}</td>
                        <td style="padding:2px 6px;color:var(--text-dim)">${esc(p[1] || "")}</td>
                        <td style="padding:2px 6px;color:var(--text-dim);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p[2] || "")}</td>
                        <td style="padding:2px 6px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(p[3] || "")}">${esc(p[3] || "")}</td></tr>`;
                }).join("");
            } catch (e) {
                if (alive) $("#_dh_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
