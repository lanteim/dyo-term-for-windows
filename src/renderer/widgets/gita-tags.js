"use strict";
window.I18N.register({
    en: { "widget.gita_tags": "Tags", "cat.git": "Git" },
    ru: { "widget.gita_tags": "Теги", "cat.git": "Git" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.gita_tags = {
    id: "gita_tags",
    title: "widget.gita_tags",
    category: "git",
    description: "Recent tags by creation date (git tag --sort=-creatordate)",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `<div id="_gt_list" style="overflow:auto;max-height:100%;font-family:var(--font-mono);font-size:12px"></div>`;
        const list = body.querySelector("#_gt_list");
        let alive = true, busy = false;
        const git = (args) => window.dyo.exec("git", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 6000 });

        const render = (rows) => {
            list.innerHTML = "";
            if (!rows.length) { list.innerHTML = `<div style="color:var(--accent2)">no tags</div>`; return; }
            rows.forEach(r => {
                const row = document.createElement("div");
                row.style.cssText = "display:flex;gap:8px;padding:3px 4px;align-items:baseline;border-bottom:1px solid var(--border)";
                row.innerHTML = `<span style="color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1" title="${esc(r.tag)}">${esc(r.tag)}</span><span style="color:var(--text-dim);flex:none;font-size:11px">${esc(r.when)}</span>`;
                if (r.subject) {
                    const sub = document.createElement("div");
                    sub.style.cssText = "color:var(--text-dim);font-size:11px;padding:0 4px 3px 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
                    sub.title = r.subject;
                    sub.textContent = r.subject;
                    const wrap = document.createElement("div");
                    wrap.appendChild(row); wrap.appendChild(sub);
                    list.appendChild(wrap);
                    return;
                }
                list.appendChild(row);
            });
        };

        const parse = (out) => {
            const rows = [];
            out.split("\n").forEach(line => {
                if (!line.trim()) return;
                const parts = line.split("\t");
                rows.push({ tag: (parts[0] || "").trim(), when: (parts[1] || "").trim(), subject: (parts[2] || "").trim() });
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
                const res = await git(["tag", "--sort=-creatordate", "-l", "--format=%(refname:short)%09%(creatordate:relative)%09%(contents:subject)"]);
                if (!res || res.code !== 0) {
                    list.innerHTML = `<div style="color:var(--text-dim)">${esc((res && res.stderr && res.stderr.trim()) || "unable to list tags")}</div>`;
                    return;
                }
                render(parse(res.stdout || ""));
            } catch (e) {
                list.innerHTML = `<div style="color:var(--danger)">error reading tags</div>`;
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
