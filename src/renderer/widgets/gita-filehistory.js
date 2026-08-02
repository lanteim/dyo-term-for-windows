"use strict";
window.I18N.register({
    en: { "widget.gita_filehistory": "File History", "cat.git": "Git" },
    ru: { "widget.gita_filehistory": "История файла", "cat.git": "Git" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.gita_filehistory = {
    id: "gita_filehistory",
    title: "widget.gita_filehistory",
    category: "git",
    description: "Commit history for one file (git log --oneline -- <file>)",
    defaultSize: { w: 10, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const shq = s => "'" + String(s).replace(/'/g, "'\\''") + "'";
        body.innerHTML = `
            <div style="display:flex;gap:6px;margin-bottom:6px">
                <input id="_gfh_in" type="text" placeholder="path/to/file" style="flex:1;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:3px 8px;font-size:12px;font-family:var(--font-mono)" />
                <button id="_gfh_go" style="background:var(--accent);color:#000;border:none;border-radius:4px;padding:3px 10px;cursor:pointer;font-size:12px">History</button>
            </div>
            <div id="_gfh_body" style="overflow:auto;max-height:calc(100% - 34px);font-family:var(--font-mono);font-size:12px"></div>`;
        const inp = body.querySelector("#_gfh_in");
        const btn = body.querySelector("#_gfh_go");
        const out = body.querySelector("#_gfh_body");
        let alive = true, busy = false;
        const git = (args) => window.dyo.exec("git", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 10000 });

        const run = async () => {
            const file = (inp.value || "").trim();
            if (!file) { out.innerHTML = `<div style="color:var(--text-dim)">enter a file path above</div>`; return; }
            if (busy) return;
            busy = true;
            out.innerHTML = `<div style="color:var(--text-dim)">loading…</div>`;
            try {
                const inside = await git(["rev-parse", "--is-inside-work-tree"]);
                if (!inside || inside.code !== 0 || inside.stdout.trim() !== "true") {
                    out.innerHTML = `<div style="color:var(--text-dim)">not a git repository</div>`;
                    return;
                }
                const res = await git(["log", "--oneline", "--follow", "--date=short", "--format=%h%x09%ad%x09%an%x09%s", "--", file]);
                if (!res || res.code !== 0) {
                    out.innerHTML = `<div style="color:var(--danger)">${esc((res && res.stderr && res.stderr.trim()) || "history failed")}</div>`;
                    return;
                }
                const lines = (res.stdout || "").split("\n").filter(l => l.trim()).slice(0, 200);
                if (!lines.length) { out.innerHTML = `<div style="color:var(--text-dim)">no history for that path</div>`; return; }
                out.innerHTML = lines.map(l => {
                    const p = l.split("\t");
                    const hash = (p[0] || "").trim(), date = (p[1] || "").trim(), an = (p[2] || "").trim(), subj = (p[3] || "").trim();
                    return `<div class="_gfh_row" data-h="${esc(hash)}" style="display:flex;gap:8px;padding:2px 2px;border-bottom:1px solid var(--border);cursor:pointer">
                        <span style="color:var(--accent);flex:none">${esc(hash)}</span>
                        <span style="color:var(--text-dim);flex:none;font-size:11px">${esc(date)}</span>
                        <span style="color:var(--accent2);flex:none;width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(an)}">${esc(an)}</span>
                        <span style="color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(subj)}">${esc(subj)}</span>
                    </div>`;
                }).join("");
                out.querySelectorAll("._gfh_row").forEach(r => {
                    r.onclick = () => {
                        const h = r.getAttribute("data-h");
                        if (h && window.term && window.term.runInFocused) window.term.runInFocused("git show " + h + " -- " + shq(file) + "\n");
                    };
                });
            } catch (e) {
                out.innerHTML = `<div style="color:var(--danger)">error reading history</div>`;
            } finally { busy = false; }
        };

        btn.onclick = run;
        inp.onkeydown = (e) => { if (e.key === "Enter") run(); };
        return { destroy: () => { alive = false; } };
    }
};
