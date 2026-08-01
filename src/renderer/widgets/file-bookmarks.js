"use strict";
window.I18N.register({
    en: { "widget.bookmarks": "Dir Bookmarks", "cat.files": "Files" },
    ru: { "widget.bookmarks": "Закладки папок", "cat.files": "Файлы" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
    const KEY = "files.bookmarks";
    const cwd = () => (window.term && window.term.lastCwd) || "";
    const shq = p => "'" + String(p).replace(/'/g, "'\\''") + "'";

    window.WIDGETS.bookmarks = {
        id: "bookmarks",
        title: "widget.bookmarks",
        category: "files",
        description: "Saved directories — click to cd in the focused terminal",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            let alive = true;
            let marks = [];
            let flashT = null;
            body.innerHTML = `
                <div style="display:flex;gap:6px;margin-bottom:8px">
                    <button id="_bm_add" style="flex:1;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text);border-radius:6px;padding:5px 10px;cursor:pointer;font-size:12px">＋ Bookmark current dir</button>
                </div>
                <div id="_bm_list" style="display:flex;flex-direction:column;gap:4px;overflow:auto;height:calc(100% - 40px)"></div>`;
            const addBtn = body.querySelector("#_bm_add");
            const list = body.querySelector("#_bm_list");

            function flash(t) {
                addBtn.textContent = t;
                if (flashT) clearTimeout(flashT);
                flashT = setTimeout(() => { if (alive) addBtn.textContent = "＋ Bookmark current dir"; }, 1500);
            }

            async function loadMarks() {
                const st = await window.dyo.settings.get();
                if (!alive) return;
                marks = (st && Array.isArray(st[KEY])) ? st[KEY].slice() : [];
                render();
            }

            async function save() {
                const patch = {}; patch[KEY] = marks;
                await window.dyo.settings.set(patch);
            }

            function render() {
                list.innerHTML = "";
                if (!marks.length) {
                    list.innerHTML = `<div style="color:var(--text-dim);font-size:12px">No bookmarks yet. Add the current directory above.</div>`;
                    return;
                }
                marks.forEach((dir, idx) => {
                    const row = document.createElement("div");
                    row.style.cssText = "display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:5px;border:1px solid var(--border)";
                    const name = document.createElement("span");
                    const base = dir.replace(/\/+$/, "").split("/").pop() || dir;
                    name.textContent = base;
                    name.title = dir;
                    name.style.cssText = "flex:1;cursor:pointer;font-family:var(--font-mono);font-size:12px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
                    name.onclick = () => { if (window.term) window.term.runInFocused("cd " + shq(dir) + "\n"); };
                    const path = document.createElement("span");
                    path.textContent = dir;
                    path.style.cssText = "color:var(--text-dim);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:45%";
                    const del = document.createElement("button");
                    del.textContent = "✕";
                    del.title = "Remove";
                    del.style.cssText = "border:none;background:transparent;color:var(--text-dim);cursor:pointer;font-size:12px;padding:0 2px;flex:0 0 auto";
                    del.onmouseenter = () => { del.style.color = "var(--danger)"; };
                    del.onmouseleave = () => { del.style.color = "var(--text-dim)"; };
                    del.onclick = async () => { marks.splice(idx, 1); await save(); render(); };
                    row.appendChild(name); row.appendChild(path); row.appendChild(del);
                    list.appendChild(row);
                });
            }

            addBtn.onclick = async () => {
                const dir = cwd();
                if (!dir) { flash("No terminal cwd"); return; }
                if (marks.indexOf(dir) >= 0) { flash("Already bookmarked"); return; }
                marks.push(dir);
                await save();
                render();
            };

            loadMarks();
            return { destroy: () => { alive = false; if (flashT) clearTimeout(flashT); } };
        }
    };
})();
