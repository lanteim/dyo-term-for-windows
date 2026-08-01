"use strict";
window.I18N.register({
    en: { "widget.gita_reflog": "Reflog", "cat.git": "Git" },
    ru: { "widget.gita_reflog": "Reflog", "cat.git": "Git" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.gita_reflog = {
    id: "gita_reflog",
    title: "widget.gita_reflog",
    category: "git",
    description: "Recent HEAD movements (git reflog -15)",
    defaultSize: { w: 10, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="color:var(--text-dim);font-size:11px;margin-bottom:6px">click an entry to copy its hash</div>
            <div id="_grf_list" style="overflow:auto;max-height:calc(100% - 20px);font-family:var(--font-mono);font-size:12px"></div>`;
        const list = body.querySelector("#_grf_list");
        let alive = true, busy = false;
        const git = (args) => window.dyo.exec("git", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 6000 });

        const parse = (out) => {
            const rows = [];
            out.split("\n").forEach(line => {
                if (!line.trim()) return;
                // "<sha> HEAD@{n}: <action>: <msg>"
                const m = line.match(/^([0-9a-f]+)\s+(HEAD@\{\d+\}):\s*(.*)$/i);
                if (m) {
                    let action = m[3], sel = "";
                    const ci = action.indexOf(":");
                    if (ci !== -1) { sel = action.slice(0, ci).trim(); action = action.slice(ci + 1).trim(); }
                    rows.push({ sha: m[1], sel, msg: action, ptr: m[2] });
                } else {
                    rows.push({ sha: "", sel: "", msg: line, ptr: "" });
                }
            });
            return rows.slice(0, 200);
        };

        const colorAction = (sel) => {
            if (/commit/.test(sel)) return "var(--accent2)";
            if (/checkout|switch/.test(sel)) return "var(--accent)";
            if (/reset|rebase/.test(sel)) return "var(--danger)";
            return "var(--text-dim)";
        };

        const render = (rows) => {
            list.innerHTML = "";
            if (!rows.length) { list.innerHTML = `<div style="color:var(--text-dim)">no reflog</div>`; return; }
            rows.forEach(r => {
                const row = document.createElement("div");
                row.style.cssText = "display:flex;gap:8px;padding:3px 2px;border-bottom:1px solid var(--border);cursor:pointer;align-items:baseline;border-radius:4px";
                row.onmouseenter = () => row.style.background = "var(--bg-elevated)";
                row.onmouseleave = () => row.style.background = "transparent";
                row.innerHTML = `
                    <span style="color:var(--accent);flex:none">${esc(r.sha)}</span>
                    ${r.sel ? `<span style="color:${colorAction(r.sel)};flex:none;width:78px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.sel)}">${esc(r.sel)}</span>` : ""}
                    <span style="color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.msg)}">${esc(r.msg)}</span>`;
                row.onclick = () => {
                    if (r.sha && navigator.clipboard) navigator.clipboard.writeText(r.sha).catch(() => {});
                };
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
                const res = await git(["reflog", "-15"]);
                if (!res || res.code !== 0) {
                    list.innerHTML = `<div style="color:var(--text-dim)">${esc((res && res.stderr && res.stderr.trim()) || "no reflog available")}</div>`;
                    return;
                }
                render(parse(res.stdout || ""));
            } catch (e) {
                list.innerHTML = `<div style="color:var(--danger)">error reading reflog</div>`;
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 5000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
