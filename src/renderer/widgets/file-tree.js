"use strict";
window.I18N.register({
    en: { "widget.filetree": "File Tree", "cat.files": "Files" },
    ru: { "widget.filetree": "Дерево файлов", "cat.files": "Файлы" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
    const join = (dir, name) => (dir.endsWith("/") ? dir + name : dir + "/" + name);
    const cwd = () => (window.term && window.term.lastCwd) || "";

    window.WIDGETS.filetree = {
        id: "filetree",
        title: "widget.filetree",
        category: "files",
        description: "Lazy directory tree of the focused terminal's cwd",
        defaultSize: { w: 6, h: 6 },
        mount(body) {
            let alive = true;
            let curRoot = "";
            body.innerHTML = `
                <div id="_ft_head" style="color:var(--text-dim);font-size:11px;margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></div>
                <div id="_ft_root" style="font-family:var(--font-mono);font-size:12px;overflow:auto;height:calc(100% - 22px)"></div>`;
            const head = body.querySelector("#_ft_head");
            const rootEl = body.querySelector("#_ft_root");

            function sortEntries(entries) {
                return entries
                    .filter(e => e && e.name && e.name[0] !== "." )
                    .sort((a, b) => (a.dir === b.dir) ? a.name.localeCompare(b.name) : (a.dir ? -1 : 1));
            }

            async function makeChildren(dir, depth) {
                const res = await window.dyo.fs.list(dir);
                const wrap = document.createElement("div");
                if (!res || res.error || !Array.isArray(res)) {
                    wrap.innerHTML = `<div style="color:var(--text-dim);padding:2px 0 2px ${depth * 14}px">— unreadable —</div>`;
                    return wrap;
                }
                const entries = sortEntries(res);
                if (!entries.length) {
                    wrap.innerHTML = `<div style="color:var(--text-dim);padding:2px 0 2px ${depth * 14}px">(empty)</div>`;
                    return wrap;
                }
                entries.slice(0, 400).forEach(e => wrap.appendChild(makeRow(dir, e, depth)));
                return wrap;
            }

            function makeRow(dir, entry, depth) {
                const full = join(dir, entry.name);
                const row = document.createElement("div");
                row.style.cssText = `display:flex;align-items:center;gap:6px;padding:2px 4px 2px ${depth * 14 + 4}px;cursor:pointer;border-radius:5px;white-space:nowrap`;
                row.onmouseenter = () => { row.style.background = "var(--bg-elevated)"; };
                row.onmouseleave = () => { row.style.background = "transparent"; };
                const icon = document.createElement("span");
                icon.textContent = entry.dir ? "▸" : "•";
                icon.style.cssText = "width:12px;color:" + (entry.dir ? "var(--accent)" : "var(--text-dim)") + ";flex:0 0 auto";
                const label = document.createElement("span");
                label.textContent = entry.name + (entry.symlink ? " ↪" : "");
                label.style.cssText = "overflow:hidden;text-overflow:ellipsis;color:" + (entry.dir ? "var(--text)" : "var(--text-dim)");
                row.appendChild(icon); row.appendChild(label);

                let childBox = null;
                let open = false;
                let loading = false;
                row.onclick = async (ev) => {
                    ev.stopPropagation();
                    if (!entry.dir) { window.dyo.openPath(full); return; }
                    if (open) {
                        if (childBox) childBox.style.display = "none";
                        open = false; icon.textContent = "▸";
                        return;
                    }
                    open = true; icon.textContent = "▾";
                    if (childBox) { childBox.style.display = "block"; return; }
                    if (loading) return;
                    loading = true;
                    childBox = await makeChildren(full, depth + 1);
                    loading = false;
                    if (!alive) return;
                    row.after(childBox);
                };
                return row;
            }

            async function build() {
                const dir = cwd();
                curRoot = dir;
                head.textContent = dir || "no terminal cwd";
                head.title = dir;
                rootEl.innerHTML = `<div style="color:var(--text-dim)">loading…</div>`;
                if (!dir) { rootEl.innerHTML = `<div style="color:var(--text-dim)">Open a terminal to see files.</div>`; return; }
                const box = await makeChildren(dir, 0);
                if (!alive || cwd() !== dir) return;
                rootEl.innerHTML = "";
                rootEl.appendChild(box);
            }

            build();
            const iv = setInterval(() => {
                if (!alive) return;
                if (cwd() !== curRoot) build();
            }, 2000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
