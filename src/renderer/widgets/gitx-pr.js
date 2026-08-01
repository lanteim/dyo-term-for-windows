"use strict";
window.I18N.register({
    en: { "widget.gitpr": "Open Pull Requests", "cat.git": "Git" },
    ru: { "widget.gitpr": "Открытые PR", "cat.git": "Git" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.gitpr = {
    id: "gitpr",
    title: "widget.gitpr",
    category: "git",
    description: "Open PRs via gh pr list (JSON). Degrades if gh missing/unauthed.",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `<div id="_pr_list" style="overflow:auto;max-height:100%;font-family:var(--font-mono);font-size:12px"></div>`;
        const list = body.querySelector("#_pr_list");
        let alive = true, busy = false;
        const gh = (args) => window.dyo.exec("gh", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 8000 });

        const info = (msg, color) => { list.innerHTML = `<div style="color:${color || "var(--text-dim)"}">${esc(msg)}</div>`; };

        const render = (prs) => {
            list.innerHTML = "";
            if (!prs.length) { info("no open pull requests", "var(--accent2)"); return; }
            prs.slice(0, 200).forEach(pr => {
                const row = document.createElement("div");
                row.style.cssText = "display:flex;gap:8px;padding:4px;border-radius:5px;cursor:pointer;align-items:baseline";
                row.onmouseenter = () => row.style.background = "var(--bg-elevated)";
                row.onmouseleave = () => row.style.background = "transparent";
                const author = pr.author && (pr.author.login || pr.author.name) || "?";
                row.innerHTML =
                    `<span style="color:var(--accent);flex:none">#${esc(pr.number)}</span>` +
                    `<span style="color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(pr.title)}</span>` +
                    `<span style="color:var(--text-dim);flex:none">${esc(pr.headRefName || "")}</span>` +
                    `<span style="color:var(--accent2);flex:none">@${esc(author)}</span>`;
                row.title = `#${pr.number} ${pr.title}`;
                row.onclick = () => {
                    if (window.term && window.term.runInFocused) window.term.runInFocused("gh pr checkout " + pr.number + "\n");
                };
                list.appendChild(row);
            });
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const res = await gh(["pr", "list", "--limit", "15", "--json", "number,title,author,headRefName"]);
                if (!res || res.code !== 0) {
                    const err = (res && (res.stderr || res.stdout) || "").toLowerCase();
                    if (!res || /not found|enoent|no such file|command not found/.test(err) || (res.code === 127)) {
                        info("gh not found — install GitHub CLI");
                    } else if (/auth|logged|token|gh auth login/.test(err)) {
                        info("gh not authenticated (run: gh auth login)");
                    } else if (/not a git repository|could not determine|no git remotes/.test(err)) {
                        info("not a GitHub repository");
                    } else {
                        info(((res.stderr || "").trim().split("\n")[0]) || "gh pr list failed");
                    }
                    return;
                }
                let prs;
                try { prs = JSON.parse(res.stdout || "[]"); } catch (e) { info("could not parse gh output"); return; }
                render(Array.isArray(prs) ? prs : []);
            } catch (e) {
                info("error running gh", "var(--danger)");
            } finally {
                busy = false;
            }
        };
        tick();
        const iv = setInterval(tick, 15000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
