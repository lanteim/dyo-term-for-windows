"use strict";
window.I18N.register({
    en: { "widget.gita_worktrees": "Worktrees", "cat.git": "Git" },
    ru: { "widget.gita_worktrees": "Рабочие деревья", "cat.git": "Git" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.gita_worktrees = {
    id: "gita_worktrees",
    title: "widget.gita_worktrees",
    category: "git",
    description: "Linked worktrees (git worktree list); click to open path",
    defaultSize: { w: 8, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `<div id="_gw_list" style="overflow:auto;max-height:100%;font-family:var(--font-mono);font-size:12px"></div>`;
        const list = body.querySelector("#_gw_list");
        let alive = true, busy = false;
        const git = (args) => window.dyo.exec("git", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 6000 });

        const parse = (out) => {
            // porcelain: blocks separated by blank line: "worktree <path>", "HEAD <sha>", "branch refs/heads/x" | "detached" | "bare"
            const blocks = out.split(/\n\n+/);
            const rows = [];
            blocks.forEach(b => {
                if (!b.trim()) return;
                const o = { path: "", sha: "", branch: "", flags: [] };
                b.split("\n").forEach(l => {
                    if (l.startsWith("worktree ")) o.path = l.slice(9);
                    else if (l.startsWith("HEAD ")) o.sha = l.slice(5, 12);
                    else if (l.startsWith("branch ")) o.branch = l.slice(7).replace(/^refs\/heads\//, "");
                    else if (l === "bare") o.flags.push("bare");
                    else if (l === "detached") o.flags.push("detached");
                    else if (l.startsWith("locked")) o.flags.push("locked");
                    else if (l.startsWith("prunable")) o.flags.push("prunable");
                });
                if (o.path) rows.push(o);
            });
            return rows.slice(0, 200);
        };

        const render = (rows) => {
            list.innerHTML = "";
            if (!rows.length) { list.innerHTML = `<div style="color:var(--text-dim)">no worktrees</div>`; return; }
            rows.forEach(r => {
                const row = document.createElement("div");
                row.style.cssText = "padding:4px 4px;border-bottom:1px solid var(--border);cursor:pointer;border-radius:5px";
                row.onmouseenter = () => row.style.background = "var(--bg-elevated)";
                row.onmouseleave = () => row.style.background = "transparent";
                const label = r.branch ? `[${r.branch}]` : (r.flags.includes("detached") ? "(detached)" : "");
                const flags = r.flags.filter(f => f !== "detached").map(f => `<span style="color:var(--danger)"> ${esc(f)}</span>`).join("");
                row.innerHTML = `
                    <div style="display:flex;gap:8px;align-items:baseline">
                        <span style="color:var(--accent2);flex:none">${esc(r.sha || "-------")}</span>
                        <span style="color:var(--accent);flex:none">${esc(label)}</span>${flags}
                    </div>
                    <div style="color:var(--text-dim);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.path)}">${esc(r.path)}</div>`;
                row.onclick = () => { if (window.dyo && window.dyo.openPath) window.dyo.openPath(r.path); };
                list.appendChild(row);
            });
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const inside = await git(["rev-parse", "--is-inside-work-tree"]);
                if (!inside || inside.code !== 0 || inside.stdout.trim() !== "true") {
                    list.innerHTML = `<div style="color:var(--text-dim)">not a git repository</div>`;
                    return;
                }
                const res = await git(["worktree", "list", "--porcelain"]);
                if (!res || res.code !== 0) {
                    list.innerHTML = `<div style="color:var(--text-dim)">${esc((res && res.stderr && res.stderr.trim()) || "unable to list worktrees")}</div>`;
                    return;
                }
                render(parse(res.stdout || ""));
            } catch (e) {
                list.innerHTML = `<div style="color:var(--danger)">error reading worktrees</div>`;
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
