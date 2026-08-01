"use strict";
window.I18N.register({
    en: { "widget.gita_branches": "Branches", "cat.git": "Git" },
    ru: { "widget.gita_branches": "Ветки", "cat.git": "Git" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.gita_branches = {
    id: "gita_branches",
    title: "widget.gita_branches",
    category: "git",
    description: "Branches by last commit date; click to checkout in focused terminal",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div id="_gb_hint" style="color:var(--text-dim);font-size:11px;margin-bottom:6px">click a branch to checkout</div>
            <div id="_gb_list" style="overflow:auto;max-height:calc(100% - 20px);font-family:var(--font-mono);font-size:12px"></div>`;
        const list = body.querySelector("#_gb_list");
        let alive = true, busy = false;
        const git = (args) => window.dyo.exec("git", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 6000 });

        const render = (rows) => {
            list.innerHTML = "";
            if (!rows.length) { list.innerHTML = `<div style="color:var(--text-dim)">no branches</div>`; return; }
            rows.forEach(r => {
                const row = document.createElement("div");
                row.style.cssText = "display:flex;gap:8px;padding:3px 4px;border-radius:5px;cursor:pointer;align-items:baseline;border-bottom:1px solid var(--border)";
                row.onmouseenter = () => row.style.background = "var(--bg-elevated)";
                row.onmouseleave = () => row.style.background = "transparent";
                const mark = r.current ? `<span style="color:var(--accent2);width:10px;flex:none">●</span>` : `<span style="width:10px;flex:none"></span>`;
                const nameColor = r.current ? "var(--accent2)" : (r.remote ? "var(--text-dim)" : "var(--text)");
                row.innerHTML = `${mark}<span style="color:${nameColor};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1" title="${esc(r.name)}">${esc(r.name)}</span><span style="color:var(--text-dim);flex:none;font-size:11px">${esc(r.when)}</span>`;
                row.onclick = () => {
                    if (r.current) return;
                    // remote branches -> checkout local tracking of last path segment
                    const target = r.remote ? r.name.replace(/^remotes\//, "").split("/").slice(1).join("/") : r.name;
                    if (window.term && window.term.runInFocused) window.term.runInFocused("git checkout " + JSON.stringify(target) + "\n");
                };
                list.appendChild(row);
            });
        };

        const parse = (out) => {
            const rows = [];
            out.split("\n").forEach(line => {
                if (!line.trim()) return;
                // format: "<*/ > <ref>\t<relative date>"
                const current = line[0] === "*";
                let rest = line.slice(2);
                const parts = rest.split("\t");
                let name = (parts[0] || "").trim();
                const when = (parts[1] || "").trim();
                if (!name || / -> /.test(name)) return; // skip symbolic HEAD pointer
                const remote = /^remotes\//.test(name);
                rows.push({ name, when, current, remote });
            });
            return rows.slice(0, 200);
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
                const res = await git(["branch", "-a", "--sort=-committerdate", "--format=%(HEAD) %(refname:short)%09%(committerdate:relative)"]);
                if (!res || res.code !== 0) {
                    list.innerHTML = `<div style="color:var(--text-dim)">${esc((res && res.stderr && res.stderr.trim()) || "unable to list branches")}</div>`;
                    return;
                }
                render(parse(res.stdout || ""));
            } catch (e) {
                list.innerHTML = `<div style="color:var(--danger)">error reading branches</div>`;
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 5000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
