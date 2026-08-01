"use strict";
window.I18N.register({
    en: { "widget.gita_blame": "Blame", "cat.git": "Git" },
    ru: { "widget.gita_blame": "Blame", "cat.git": "Git" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.gita_blame = {
    id: "gita_blame",
    title: "widget.gita_blame",
    category: "git",
    description: "git blame a file: author per line (capped at 200)",
    defaultSize: { w: 10, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;gap:6px;margin-bottom:6px">
                <input id="_gbl_in" type="text" placeholder="path/to/file (relative to repo)" style="flex:1;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:3px 8px;font-size:12px;font-family:var(--font-mono)" />
                <button id="_gbl_go" style="background:var(--accent);color:#000;border:none;border-radius:4px;padding:3px 10px;cursor:pointer;font-size:12px">Blame</button>
            </div>
            <div id="_gbl_body" style="overflow:auto;max-height:calc(100% - 34px);font-family:var(--font-mono);font-size:12px;line-height:1.5"></div>`;
        const inp = body.querySelector("#_gbl_in");
        const btn = body.querySelector("#_gbl_go");
        const out = body.querySelector("#_gbl_body");
        let alive = true, busy = false;
        const git = (args) => window.dyo.exec("git", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 10000 });

        // stable-ish color from author name
        const colorFor = (name) => {
            let h = 0;
            for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
            const hue = h % 360;
            return `hsl(${hue},55%,65%)`;
        };

        const parsePorcelain = (text) => {
            // git blame --line-porcelain: blocks with author + \t<code>
            const lines = text.split("\n");
            const rows = [];
            let author = "?", ln = "";
            for (const l of lines) {
                if (l.startsWith("author ")) { author = l.slice(7); continue; }
                if (l[0] === "\t") { ln = l.slice(1); rows.push({ author, code: ln }); }
            }
            return rows.slice(0, 200);
        };

        const run = async () => {
            const file = (inp.value || "").trim();
            if (!file) { out.innerHTML = `<div style="color:var(--text-dim)">enter a file path above</div>`; return; }
            if (busy) return;
            busy = true;
            out.innerHTML = `<div style="color:var(--text-dim)">blaming…</div>`;
            try {
                const inside = await git(["rev-parse", "--is-inside-work-tree"]);
                if (!inside || inside.code !== 0 || inside.stdout.trim() !== "true") {
                    out.innerHTML = `<div style="color:var(--text-dim)">not a git repository</div>`;
                    return;
                }
                const res = await git(["blame", "--line-porcelain", "--", file]);
                if (!res || res.code !== 0) {
                    out.innerHTML = `<div style="color:var(--danger)">${esc((res && res.stderr && res.stderr.trim()) || "blame failed (no such file?)")}</div>`;
                    return;
                }
                const rows = parsePorcelain(res.stdout || "");
                if (!rows.length) { out.innerHTML = `<div style="color:var(--text-dim)">empty file</div>`; return; }
                out.innerHTML = rows.map((r, i) => {
                    return `<div style="display:flex;gap:8px;white-space:pre">
                        <span style="color:var(--text-dim);flex:none;width:34px;text-align:right;user-select:none">${i + 1}</span>
                        <span style="color:${colorFor(r.author)};flex:none;width:110px;overflow:hidden;text-overflow:ellipsis" title="${esc(r.author)}">${esc(r.author)}</span>
                        <span style="color:var(--text);flex:1">${esc(r.code)}</span>
                    </div>`;
                }).join("");
            } catch (e) {
                out.innerHTML = `<div style="color:var(--danger)">error running blame</div>`;
            } finally { busy = false; }
        };

        btn.onclick = run;
        inp.onkeydown = (e) => { if (e.key === "Enter") run(); };
        return { destroy: () => { alive = false; } };
    }
};
