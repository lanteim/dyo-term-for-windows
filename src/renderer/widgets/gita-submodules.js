"use strict";
window.I18N.register({
    en: { "widget.gita_submodules": "Submodules", "cat.git": "Git" },
    ru: { "widget.gita_submodules": "Субмодули", "cat.git": "Git" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.gita_submodules = {
    id: "gita_submodules",
    title: "widget.gita_submodules",
    category: "git",
    description: "Submodule status (git submodule status)",
    defaultSize: { w: 8, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `<div id="_gsm_list" style="overflow:auto;max-height:100%;font-family:var(--font-mono);font-size:12px"></div>`;
        const list = body.querySelector("#_gsm_list");
        let alive = true, busy = false;
        const git = (args) => window.dyo.exec("git", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 8000 });

        // prefix: ' '=in sync, '-'=not initialized, '+'=checked out different commit, 'U'=merge conflicts
        const stateOf = (ch) => {
            if (ch === "-") return { label: "not init", color: "var(--text-dim)" };
            if (ch === "+") return { label: "out of sync", color: "var(--accent)" };
            if (ch === "U") return { label: "conflict", color: "var(--danger)" };
            return { label: "in sync", color: "var(--accent2)" };
        };

        const parse = (out) => {
            const rows = [];
            out.split("\n").forEach(line => {
                if (!line.trim()) return;
                const ch = line[0];
                const rest = line.slice(1);
                const m = rest.match(/^([0-9a-f]+)\s+(\S+)(?:\s+\((.*)\))?\s*$/i);
                if (m) rows.push({ ch, sha: m[1].slice(0, 8), path: m[2], ref: m[3] || "" });
            });
            return rows.slice(0, 200);
        };

        const render = (rows) => {
            list.innerHTML = "";
            if (!rows.length) { list.innerHTML = `<div style="color:var(--text-dim)">no submodules</div>`; return; }
            rows.forEach(r => {
                const st = stateOf(r.ch);
                const div = document.createElement("div");
                div.style.cssText = "padding:4px 4px;border-bottom:1px solid var(--border)";
                div.innerHTML = `
                    <div style="display:flex;gap:8px;align-items:baseline">
                        <span style="color:${st.color};flex:none;width:66px;font-size:11px">${esc(st.label)}</span>
                        <span style="color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1" title="${esc(r.path)}">${esc(r.path)}</span>
                        <span style="color:var(--accent2);flex:none">${esc(r.sha)}</span>
                    </div>
                    ${r.ref ? `<div style="color:var(--text-dim);font-size:11px">${esc(r.ref)}</div>` : ""}`;
                list.appendChild(div);
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
                const res = await git(["submodule", "status"]);
                if (!res || res.code !== 0) {
                    list.innerHTML = `<div style="color:var(--text-dim)">${esc((res && res.stderr && res.stderr.trim()) || "unable to read submodules")}</div>`;
                    return;
                }
                render(parse(res.stdout || ""));
            } catch (e) {
                list.innerHTML = `<div style="color:var(--danger)">error reading submodules</div>`;
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
