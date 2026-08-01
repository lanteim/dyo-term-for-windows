"use strict";
window.I18N.register({
    en: { "widget.gita_search": "Pickaxe Search", "cat.git": "Git" },
    ru: { "widget.gita_search": "Поиск по коду", "cat.git": "Git" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.gita_search = {
    id: "gita_search",
    title: "widget.gita_search",
    category: "git",
    description: "Find commits that added/removed a string (git log -S)",
    defaultSize: { w: 10, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;gap:6px;margin-bottom:6px">
                <input id="_gs_in" type="text" placeholder="text to search in commit content" style="flex:1;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:3px 8px;font-size:12px;font-family:var(--font-mono)" />
                <button id="_gs_go" style="background:var(--accent);color:#000;border:none;border-radius:4px;padding:3px 10px;cursor:pointer;font-size:12px">Search</button>
            </div>
            <div id="_gs_body" style="overflow:auto;max-height:calc(100% - 34px);font-family:var(--font-mono);font-size:12px"></div>`;
        const inp = body.querySelector("#_gs_in");
        const btn = body.querySelector("#_gs_go");
        const out = body.querySelector("#_gs_body");
        let alive = true, busy = false;
        const git = (args) => window.dyo.exec("git", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 12000 });

        const run = async () => {
            const q = (inp.value || "").trim();
            if (!q) { out.innerHTML = `<div style="color:var(--text-dim)">enter search text above</div>`; return; }
            if (busy) return;
            busy = true;
            out.innerHTML = `<div style="color:var(--text-dim)">searching…</div>`;
            try {
                const inside = await git(["rev-parse", "--is-inside-work-tree"]);
                if (!inside || inside.code !== 0 || inside.stdout.trim() !== "true") {
                    out.innerHTML = `<div style="color:var(--text-dim)">not a git repository</div>`;
                    return;
                }
                const res = await git(["log", "-S" + q, "--oneline", "-20"]);
                if (!res || res.code !== 0) {
                    out.innerHTML = `<div style="color:var(--danger)">${esc((res && res.stderr && res.stderr.trim()) || "search failed")}</div>`;
                    return;
                }
                const lines = (res.stdout || "").split("\n").filter(l => l.trim()).slice(0, 200);
                if (!lines.length) { out.innerHTML = `<div style="color:var(--text-dim)">no commits touched “${esc(q)}”</div>`; return; }
                out.innerHTML = lines.map(l => {
                    const m = l.match(/^([0-9a-f]{7,40})\s(.*)$/i);
                    const hash = m ? m[1] : "";
                    const rest = m ? m[2] : l;
                    return `<div style="display:flex;gap:8px;padding:2px 2px;border-bottom:1px solid var(--border);cursor:pointer" data-h="${esc(hash)}" class="_gs_row">
                        <span style="color:var(--accent);flex:none">${esc(hash)}</span>
                        <span style="color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(rest)}">${esc(rest)}</span>
                    </div>`;
                }).join("");
                out.querySelectorAll("._gs_row").forEach(r => {
                    r.onclick = () => {
                        const h = r.getAttribute("data-h");
                        if (h && window.term && window.term.runInFocused) window.term.runInFocused("git show " + h + "\n");
                    };
                });
            } catch (e) {
                out.innerHTML = `<div style="color:var(--danger)">error running search</div>`;
            } finally { busy = false; }
        };

        btn.onclick = run;
        inp.onkeydown = (e) => { if (e.key === "Enter") run(); };
        return { destroy: () => { alive = false; } };
    }
};
