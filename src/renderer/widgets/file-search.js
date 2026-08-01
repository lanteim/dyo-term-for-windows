"use strict";
window.I18N.register({
    en: { "widget.projsearch": "Project Search", "cat.files": "Files" },
    ru: { "widget.projsearch": "Поиск в проекте", "cat.files": "Файлы" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
    const join = (dir, rel) => {
        let r = rel.replace(/^\.\//, "");
        return dir.endsWith("/") ? dir + r : dir + "/" + r;
    };
    const cwd = () => (window.term && window.term.lastCwd) || "";

    window.WIDGETS.projsearch = {
        id: "projsearch",
        title: "widget.projsearch",
        category: "files",
        description: "Search file contents in cwd via ripgrep (grep fallback)",
        defaultSize: { w: 12, h: 5 },
        mount(body) {
            let alive = true, busy = false;
            body.innerHTML = `
                <div style="display:flex;gap:6px;margin-bottom:8px">
                    <input id="_ps_q" placeholder="search text… (Enter)" spellcheck="false"
                        style="flex:1;background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 10px;font-family:var(--font-mono);font-size:12px;outline:none">
                    <button id="_ps_go" style="border:1px solid var(--border);background:var(--bg-elevated);color:var(--text);border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px">Search</button>
                </div>
                <div id="_ps_meta" style="color:var(--text-dim);font-size:11px;margin-bottom:6px"></div>
                <div id="_ps_res" style="font-family:var(--font-mono);font-size:12px;overflow:auto;height:calc(100% - 70px)"></div>`;
            const q = body.querySelector("#_ps_q");
            const go = body.querySelector("#_ps_go");
            const meta = body.querySelector("#_ps_meta");
            const res = body.querySelector("#_ps_res");

            function parseLines(out, dir) {
                // Format from both rg -n and grep -rn: path:line:content
                const rows = [];
                out.split("\n").forEach(line => {
                    if (!line.trim()) return;
                    const m = /^(.*?):(\d+):(.*)$/.exec(line);
                    if (!m) return;
                    rows.push({ file: m[1].replace(/^\.\//, ""), line: m[2], text: m[3], full: join(dir, m[1]) });
                });
                return rows;
            }

            function render(rows) {
                res.innerHTML = "";
                if (!rows.length) { res.innerHTML = `<div style="color:var(--text-dim)">No matches.</div>`; return; }
                rows.slice(0, 60).forEach(r => {
                    const row = document.createElement("div");
                    row.style.cssText = "padding:4px 6px;border-radius:5px;cursor:pointer;border-bottom:1px solid var(--border)";
                    row.onmouseenter = () => { row.style.background = "var(--bg-elevated)"; };
                    row.onmouseleave = () => { row.style.background = "transparent"; };
                    row.title = r.full + ":" + r.line;
                    const snippet = r.text.length > 200 ? r.text.slice(0, 200) + "…" : r.text;
                    row.innerHTML = `<span style="color:var(--accent)">${esc(r.file)}</span>` +
                        `<span style="color:var(--text-dim)">:${esc(r.line)}</span> ` +
                        `<span style="color:var(--text)">${esc(snippet.trim())}</span>`;
                    row.onclick = () => window.dyo.openPath(r.full);
                    res.appendChild(row);
                });
            }

            async function search() {
                if (!alive || busy) return;
                const query = q.value.trim();
                if (!query) { res.innerHTML = ""; meta.textContent = ""; return; }
                const dir = cwd();
                if (!dir) { meta.textContent = "no terminal cwd"; return; }
                busy = true;
                go.disabled = true;
                meta.textContent = "searching…";
                let out = "", used = "rg";
                let r = await window.dyo.exec("rg", ["-n", "--max-count", "3", "--", query], { cwd: dir, timeout: 8000 });
                if (!alive) { busy = false; return; }
                if (r && r.code === 127 || (r && r.stderr && /not found|No such file/i.test(r.stderr) && !r.stdout)) {
                    used = "grep";
                    r = await window.dyo.exec("grep", ["-rn", "--", query, "."], { cwd: dir, timeout: 8000 });
                }
                busy = false;
                go.disabled = false;
                if (!alive) return;
                if (!r) { meta.textContent = "search failed"; res.innerHTML = ""; return; }
                out = r.stdout || "";
                // rg/grep exit 1 = no matches (not an error).
                if (r.code !== 0 && r.code !== 1 && !out) {
                    meta.textContent = (used === "rg" ? "ripgrep" : "grep") + " error";
                    res.innerHTML = `<div style="color:var(--text-dim)">${esc((r.stderr || "").split("\n")[0] || "")}</div>`;
                    return;
                }
                const rows = parseLines(out, dir);
                meta.textContent = `${rows.length}${rows.length >= 60 ? "+" : ""} match${rows.length === 1 ? "" : "es"} · ${used}`;
                render(rows);
            }

            go.onclick = search;
            q.addEventListener("keydown", e => { if (e.key === "Enter") search(); });
            const focusT = setTimeout(() => { if (alive) q.focus(); }, 50);
            return { destroy: () => { alive = false; clearTimeout(focusT); } };
        }
    };
})();
