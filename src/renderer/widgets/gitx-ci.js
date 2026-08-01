"use strict";
window.I18N.register({
    en: { "widget.gitci": "CI Runs", "cat.git": "Git" },
    ru: { "widget.gitci": "Запуски CI", "cat.git": "Git" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.gitci = {
    id: "gitci",
    title: "widget.gitci",
    category: "git",
    description: "Recent CI runs via gh run list. Degrades if gh missing.",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `<div id="_ci_list" style="overflow:auto;max-height:100%;font-family:var(--font-mono);font-size:12px"></div>`;
        const list = body.querySelector("#_ci_list");
        let alive = true, busy = false;
        const gh = (args) => window.dyo.exec("gh", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 8000 });

        const info = (msg, color) => { list.innerHTML = `<div style="color:${color || "var(--text-dim)"}">${esc(msg)}</div>`; };

        const statusMeta = (concl, status) => {
            const s = (concl || status || "").toLowerCase();
            if (s === "success") return { icon: "●", color: "var(--accent2)" };
            if (s === "failure" || s === "timed_out" || s === "startup_failure") return { icon: "●", color: "var(--danger)" };
            if (s === "cancelled" || s === "skipped" || s === "neutral") return { icon: "○", color: "var(--text-dim)" };
            // in progress / queued / pending
            return { icon: "◐", color: "var(--accent)" };
        };

        const render = (runs) => {
            list.innerHTML = "";
            if (!runs.length) { info("no recent runs", "var(--text-dim)"); return; }
            runs.slice(0, 200).forEach(r => {
                const m = statusMeta(r.conclusion, r.status);
                const row = document.createElement("div");
                row.style.cssText = "display:flex;gap:8px;padding:4px;border-radius:5px;align-items:baseline";
                const name = r.name || r.workflowName || r.displayTitle || "run";
                row.innerHTML =
                    `<span style="color:${m.color};flex:none">${m.icon}</span>` +
                    `<span style="color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</span>` +
                    `<span style="color:var(--text-dim);flex:none">${esc(r.headBranch || "")}</span>` +
                    `<span style="color:${m.color};flex:none">${esc(r.conclusion || r.status || "")}</span>`;
                list.appendChild(row);
            });
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const res = await gh(["run", "list", "--limit", "12", "--json", "name,workflowName,displayTitle,headBranch,status,conclusion"]);
                if (!res || res.code !== 0) {
                    const err = (res && (res.stderr || res.stdout) || "").toLowerCase();
                    if (!res || /not found|enoent|no such file|command not found/.test(err) || (res.code === 127)) {
                        info("gh not found — install GitHub CLI");
                    } else if (/auth|logged|token|gh auth login/.test(err)) {
                        info("gh not authenticated (run: gh auth login)");
                    } else if (/not a git repository|could not determine|no git remotes/.test(err)) {
                        info("not a GitHub repository");
                    } else if (/no workflow|no runs/.test(err)) {
                        info("no workflow runs found");
                    } else {
                        info(((res.stderr || "").trim().split("\n")[0]) || "gh run list failed");
                    }
                    return;
                }
                let runs;
                try { runs = JSON.parse(res.stdout || "[]"); } catch (e) { info("could not parse gh output"); return; }
                render(Array.isArray(runs) ? runs : []);
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
