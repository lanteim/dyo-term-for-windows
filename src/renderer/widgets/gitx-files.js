"use strict";
window.I18N.register({
    en: { "widget.gitfiles": "Changed Files", "cat.git": "Git" },
    ru: { "widget.gitfiles": "Изменённые файлы", "cat.git": "Git" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.gitfiles = {
    id: "gitfiles",
    title: "widget.gitfiles",
    category: "git",
    description: "git status --porcelain; click a file to git add it",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div id="_gf_hint" style="color:var(--text-dim);font-size:11px;margin-bottom:6px">click a file to stage it (git add)</div>
            <div id="_gf_list" style="overflow:auto;max-height:100%;font-family:var(--font-mono);font-size:12px"></div>`;
        const list = body.querySelector("#_gf_list");
        const hint = body.querySelector("#_gf_hint");
        let alive = true, busy = false;
        const git = (args) => window.dyo.exec("git", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 6000 });

        const colorForStatus = (xy) => {
            const c = xy.replace(/\s/g, "");
            if (/\?/.test(xy)) return "var(--text-dim)"; // untracked
            if (/^[MARC]/.test(xy.trimEnd())) return "var(--accent2)"; // staged
            if (/[MD]/.test(xy[1])) return "var(--accent)"; // modified in worktree
            return "var(--text)";
        };

        const render = (entries) => {
            list.innerHTML = "";
            if (!entries.length) {
                list.innerHTML = `<div style="color:var(--accent2)">working tree clean</div>`;
                return;
            }
            entries.forEach(en => {
                const row = document.createElement("div");
                row.style.cssText = "display:flex;gap:8px;padding:3px 4px;border-radius:5px;cursor:pointer;align-items:baseline";
                row.onmouseenter = () => row.style.background = "var(--bg-elevated)";
                row.onmouseleave = () => row.style.background = "transparent";
                row.innerHTML = `<span style="color:${colorForStatus(en.xy)};width:22px;flex:none;text-align:center">${esc(en.xy.replace(/ /g, "·"))}</span><span style="color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(en.file)}</span>`;
                row.onclick = () => {
                    if (window.term && window.term.runInFocused) window.term.runInFocused("git add " + JSON.stringify(en.file) + "\n");
                };
                list.appendChild(row);
            });
        };

        const parse = (out) => {
            const entries = [];
            out.split("\n").forEach(line => {
                if (!line.trim()) return;
                const xy = line.slice(0, 2);
                let file = line.slice(3);
                // handle rename "orig -> new"
                const arrow = file.indexOf(" -> ");
                if (arrow !== -1) file = file.slice(arrow + 4);
                // porcelain may quote paths with special chars
                if (file.startsWith('"') && file.endsWith('"')) {
                    try { file = JSON.parse(file); } catch (e) { /* keep raw */ }
                }
                entries.push({ xy, file });
            });
            return entries.slice(0, 200);
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
                const res = await git(["status", "--porcelain"]);
                if (!res || res.code !== 0) {
                    list.innerHTML = `<div style="color:var(--text-dim)">${esc((res && res.stderr && res.stderr.trim()) || "unable to read status")}</div>`;
                    return;
                }
                render(parse(res.stdout || ""));
            } catch (e) {
                list.innerHTML = `<div style="color:var(--danger)">error reading status</div>`;
            } finally {
                busy = false;
            }
        };
        tick();
        const iv = setInterval(tick, 3000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
