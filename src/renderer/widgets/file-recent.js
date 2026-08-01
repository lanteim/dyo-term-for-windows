"use strict";
window.I18N.register({
    en: { "widget.recentfiles": "Recent Files", "cat.files": "Files" },
    ru: { "widget.recentfiles": "Недавние файлы", "cat.files": "Файлы" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
    const join = (dir, rel) => {
        let r = rel.replace(/^\.\//, "");
        return dir.endsWith("/") ? dir + r : dir + "/" + r;
    };
    const cwd = () => (window.term && window.term.lastCwd) || "";

    window.WIDGETS.recentfiles = {
        id: "recentfiles",
        title: "widget.recentfiles",
        category: "files",
        description: "Recently modified files under the terminal cwd",
        defaultSize: { w: 6, h: 4 },
        mount(body) {
            let alive = true, busy = false, lastDir = "\0";
            body.innerHTML = `
                <div id="_rf_head" style="color:var(--text-dim);font-size:11px;margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></div>
                <div id="_rf_list" style="font-family:var(--font-mono);font-size:12px;overflow:auto;height:calc(100% - 22px)"></div>`;
            const head = body.querySelector("#_rf_head");
            const list = body.querySelector("#_rf_list");

            function msg(t) { list.innerHTML = `<div style="color:var(--text-dim)">${esc(t)}</div>`; }

            async function load() {
                if (!alive || busy) return;
                const dir = cwd();
                head.textContent = dir || "no terminal cwd";
                head.title = dir;
                if (!dir) { msg("Open a terminal to see files."); lastDir = ""; return; }
                busy = true;
                // Newest first, exclude .git; -mtime -1 = modified within last day.
                let res = await window.dyo.exec("find",
                    [".", "-type", "f", "-not", "-path", "*/.git/*", "-mtime", "-1"],
                    { cwd: dir, timeout: 8000 });
                if (!alive) { busy = false; return; }
                let files = [];
                if (res && res.code === 0 && res.stdout && res.stdout.trim()) {
                    files = res.stdout.split("\n").map(s => s.trim()).filter(Boolean);
                }
                if (!files.length) {
                    // Fallback: plain ls -t of the directory.
                    const ls = await window.dyo.exec("ls", ["-t"], { cwd: dir, timeout: 5000 });
                    if (!alive) { busy = false; return; }
                    if (ls && ls.code === 0 && ls.stdout && ls.stdout.trim()) {
                        files = ls.stdout.split("\n").map(s => s.trim()).filter(Boolean).map(f => "./" + f);
                    }
                }
                busy = false;
                lastDir = dir;
                if (cwd() !== dir) return;
                render(dir, files);
            }

            function render(dir, files) {
                list.innerHTML = "";
                if (!files.length) { msg("No recently modified files."); return; }
                files.slice(0, 15).forEach(rel => {
                    const full = join(dir, rel);
                    const name = rel.replace(/^\.\//, "");
                    const row = document.createElement("div");
                    row.style.cssText = "padding:3px 6px;cursor:pointer;border-radius:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
                    row.textContent = name;
                    row.title = full;
                    row.onmouseenter = () => { row.style.background = "var(--bg-elevated)"; };
                    row.onmouseleave = () => { row.style.background = "transparent"; };
                    row.onclick = () => window.dyo.openPath(full);
                    list.appendChild(row);
                });
            }

            load();
            const iv = setInterval(() => {
                if (cwd() !== lastDir) load();
            }, 3000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
