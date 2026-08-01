"use strict";
window.I18N.register({
    en: { "widget.gita_contributors": "Contributors", "cat.git": "Git" },
    ru: { "widget.gita_contributors": "Авторы", "cat.git": "Git" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.gita_contributors = {
    id: "gita_contributors",
    title: "widget.gita_contributors",
    category: "git",
    description: "Top authors by commit count (git shortlog -sn)",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `<div id="_gc_list" style="overflow:auto;max-height:100%;font-size:12px"></div>`;
        const list = body.querySelector("#_gc_list");
        let alive = true, busy = false;
        const git = (args) => window.dyo.exec("git", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 8000 });

        const render = (rows) => {
            list.innerHTML = "";
            if (!rows.length) { list.innerHTML = `<div style="color:var(--text-dim)">no commits yet</div>`; return; }
            const max = Math.max(1, ...rows.map(r => r.count));
            rows.forEach(r => {
                const w = Math.round((r.count / max) * 100);
                const div = document.createElement("div");
                div.style.cssText = "padding:3px 2px;border-bottom:1px solid var(--border)";
                div.innerHTML = `
                    <div style="display:flex;justify-content:space-between;gap:8px">
                        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.name)}">${esc(r.name)}</span>
                        <span style="flex:none;color:var(--accent);font-variant-numeric:tabular-nums">${r.count}</span>
                    </div>
                    <div class="bar" style="margin-top:3px;width:${w}%;min-width:6px"><i style="width:100%;background:var(--accent)"></i></div>`;
                list.appendChild(div);
            });
        };

        const parse = (out) => {
            const rows = [];
            out.split("\n").forEach(line => {
                if (!line.trim()) return;
                const m = line.match(/^\s*(\d+)\s+(.*)$/);
                if (m) rows.push({ count: parseInt(m[1], 10), name: m[2].trim() });
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
                const res = await git(["shortlog", "-sn", "--all", "--no-merges", "HEAD"]);
                if (!res || res.code !== 0) {
                    // fallback without HEAD (empty repo etc.)
                    list.innerHTML = `<div style="color:var(--text-dim)">${esc((res && res.stderr && res.stderr.trim()) || "no commits yet")}</div>`;
                    return;
                }
                render(parse(res.stdout || ""));
            } catch (e) {
                list.innerHTML = `<div style="color:var(--danger)">error reading contributors</div>`;
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
