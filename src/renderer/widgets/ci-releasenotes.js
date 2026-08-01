"use strict";
window.I18N.register({
    en: { "widget.ci_releasenotes": "Releases", "cat.cicd": "CI/CD" },
    ru: { "widget.ci_releasenotes": "Релизы", "cat.cicd": "CI/CD" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.ci_releasenotes = {
    id: "ci_releasenotes",
    title: "widget.ci_releasenotes",
    category: "cicd",
    description: "Latest releases via gh release list, falling back to git tags",
    defaultSize: { w: 8, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">📦 Releases</span><span class="v" id="_rn_sum">…</span></div>
            <div id="_rn_src" style="color:var(--text-dim);font-size:10px;margin:2px 0"></div>
            <div id="_rn_msg" style="color:var(--text-dim);font-size:11px;margin:4px 0"></div>
            <div style="overflow:auto;max-height:100%">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px">TAG</th><th style="padding:2px 6px">NAME / TYPE</th>
                  <th style="padding:2px 6px">DATE</th>
                </tr></thead>
                <tbody id="_rn_rows"></tbody>
              </table>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const cwd = () => (window.term ? window.term.lastCwd : undefined);
        const exec = (cmd, argv) => window.dyo.exec(cmd, argv, { cwd: cwd(), timeout: 12000 });

        const renderRows = rows => {
            $("#_rn_rows").innerHTML = rows.slice(0, 200).map(r => `<tr style="border-top:1px solid var(--border)">
                <td style="padding:2px 6px;color:var(--accent);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.tag)}">${esc(r.tag)}</td>
                <td style="padding:2px 6px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.name)}">${esc(r.name)}</td>
                <td style="padding:2px 6px;color:var(--text-dim)">${esc(r.date)}</td></tr>`).join("");
            $("#_rn_sum").innerHTML = `<b style="color:var(--accent2)">${rows.length}</b>`;
        };

        const fromTags = async () => {
            const inside = await exec("git", ["rev-parse", "--is-inside-work-tree"]);
            if (!inside || inside.code !== 0 || inside.stdout.trim() !== "true") {
                $("#_rn_msg").innerHTML = `<span style="color:var(--text-dim)">no gh releases and not a git repo</span>`;
                $("#_rn_sum").textContent = "—"; $("#_rn_rows").innerHTML = ""; return;
            }
            const r = await exec("git", ["for-each-ref", "--sort=-creatordate", "--count=50", "--format=%(refname:short)\x1f%(creatordate:short)\x1f%(contents:subject)", "refs/tags"]);
            if (!alive) return;
            const lines = (r && r.code === 0 ? r.stdout : "").split("\n").filter(l => l.trim());
            if (!lines.length) { $("#_rn_msg").innerHTML = `<span style="color:var(--text-dim)">no tags / releases</span>`; $("#_rn_sum").textContent = "0"; $("#_rn_rows").innerHTML = ""; return; }
            $("#_rn_msg").textContent = "";
            renderRows(lines.map(l => { const p = l.split("\x1f"); return { tag: p[0] || "", name: p[2] || "—", date: p[1] || "" }; }));
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const g = await exec("gh", ["release", "list", "--limit", "20"]);
                if (!alive) return;
                if (g && g.code === 0 && g.stdout.trim()) {
                    // gh release list columns are tab-separated: TITLE, TYPE, TAG, PUBLISHED
                    const rows = g.stdout.split("\n").filter(l => l.trim()).map(l => {
                        const c = l.split("\t").map(x => x.trim());
                        // Layout: title, type(Latest/Pre-release/Draft/""), tag, published
                        const tag = c[2] || c[0] || "";
                        const name = (c[0] || "") + (c[1] ? " · " + c[1] : "");
                        const date = (c[3] || "").replace("T", " ").replace("Z", "");
                        return { tag, name, date };
                    });
                    $("#_rn_src").textContent = "source: gh release";
                    $("#_rn_msg").textContent = "";
                    renderRows(rows);
                } else {
                    $("#_rn_src").textContent = "source: git tags (gh unavailable)";
                    await fromTags();
                }
            } catch (e) {
                if (alive) $("#_rn_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 20000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
