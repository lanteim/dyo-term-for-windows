"use strict";
window.I18N.register({
    en: { "widget.gitlog": "Git Log Graph", "cat.git": "Git" },
    ru: { "widget.gitlog": "Граф коммитов", "cat.git": "Git" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.gitlog = {
    id: "gitlog",
    title: "widget.gitlog",
    category: "git",
    description: "Recent commit graph (git log --graph --oneline)",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `<pre id="_gl_pre" style="margin:0;overflow:auto;max-height:100%;font-family:var(--font-mono);font-size:12px;line-height:1.45;white-space:pre;color:var(--text)"></pre>`;
        const pre = body.querySelector("#_gl_pre");
        let alive = true, busy = false;
        const git = (args) => window.dyo.exec("git", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 6000 });

        // Colorize: graph chars (* | / \ _) subtly in accent2, hash (7-8 hex at line start after graph) in accent,
        // (decorations) in danger-ish. Everything else plain.
        const colorLine = (line) => {
            // split leading graph part from the rest
            const m = line.match(/^([\s*|\/\\_.-]*)(.*)$/);
            const graph = m ? m[1] : "";
            let rest = m ? m[2] : line;
            let html = `<span style="color:var(--accent2)">${esc(graph)}</span>`;
            // hash at start of rest
            const hm = rest.match(/^([0-9a-f]{7,40})(.*)$/i);
            if (hm) {
                html += `<span style="color:var(--accent)">${esc(hm[1])}</span>`;
                rest = hm[2];
            }
            // decorations in parentheses right after hash
            rest = esc(rest).replace(/(\([^)]*\))/, `<span style="color:var(--danger)">$1</span>`);
            html += rest;
            return html;
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const inside = await git(["rev-parse", "--is-inside-work-tree"]);
                if (!inside || inside.code !== 0 || inside.stdout.trim() !== "true") {
                    pre.innerHTML = `<span style="color:var(--text-dim)">not a git repository</span>`;
                    return;
                }
                const res = await git(["log", "--graph", "--oneline", "--decorate", "-20"]);
                if (!res || res.code !== 0) {
                    pre.innerHTML = `<span style="color:var(--text-dim)">${esc((res && res.stderr && res.stderr.trim()) || "no commits yet")}</span>`;
                    return;
                }
                const lines = res.stdout.split("\n").slice(0, 200);
                pre.innerHTML = lines.map(colorLine).join("\n");
            } catch (e) {
                pre.innerHTML = `<span style="color:var(--danger)">error reading git log</span>`;
            } finally {
                busy = false;
            }
        };
        tick();
        const iv = setInterval(tick, 4000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
