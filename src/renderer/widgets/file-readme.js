"use strict";
window.I18N.register({
    en: { "widget.readme": "README", "cat.files": "Files" },
    ru: { "widget.readme": "README", "cat.files": "Файлы" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
    const join = (dir, name) => (dir.endsWith("/") ? dir + name : dir + "/" + name);
    const cwd = () => (window.term && window.term.lastCwd) || "";

    // Light markdown → plain text: keep readable, drop noisy syntax.
    function lighten(md) {
        return md.split("\n").map(line => {
            let l = line.replace(/^\s*#{1,6}\s+/, "");        // heading markers
            l = l.replace(/^\s{0,3}[-*+]\s+/, "• ");            // bullets
            l = l.replace(/`([^`]+)`/g, "$1");                  // inline code
            l = l.replace(/\*\*([^*]+)\*\*/g, "$1");            // bold
            l = l.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "$1");   // italics
            l = l.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)"); // links
            return l;
        }).join("\n");
    }

    window.WIDGETS.readme = {
        id: "readme",
        title: "widget.readme",
        category: "files",
        description: "Renders the README of the terminal cwd as plain text",
        defaultSize: { w: 6, h: 6 },
        mount(body) {
            let alive = true, busy = false, lastDir = "\0";
            body.innerHTML = `
                <div id="_rm_head" style="color:var(--text-dim);font-size:11px;margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></div>
                <pre id="_rm_body" style="margin:0;font-family:var(--font-mono);font-size:12px;line-height:1.5;color:var(--text);white-space:pre-wrap;word-break:break-word;overflow:auto;height:calc(100% - 22px)"></pre>`;
            const head = body.querySelector("#_rm_head");
            const pre = body.querySelector("#_rm_body");

            async function load() {
                if (!alive || busy) return;
                const dir = cwd();
                if (!dir) { head.textContent = "no terminal cwd"; pre.textContent = "Open a terminal to see a README."; lastDir = ""; return; }
                busy = true;
                lastDir = dir;
                const listing = await window.dyo.fs.list(dir);
                if (!alive) { busy = false; return; }
                let found = null;
                if (Array.isArray(listing)) {
                    const cand = listing.filter(e => !e.dir && /^readme(\.(md|markdown|txt|rst))?$/i.test(e.name));
                    // Prefer README.md, else first match.
                    found = cand.find(e => /\.md$/i.test(e.name)) || cand[0];
                }
                if (!found) {
                    busy = false;
                    head.textContent = dir;
                    pre.textContent = "No README found in this directory.";
                    return;
                }
                const full = join(dir, found.name);
                const r = await window.dyo.fs.read(full, 200000);
                busy = false;
                if (!alive || cwd() !== dir) return;
                head.textContent = found.name + " · " + dir;
                head.title = full;
                if (!r || r.error || typeof r.content !== "string") {
                    pre.textContent = "Could not read " + found.name + (r && r.error ? ": " + r.error : "");
                    return;
                }
                const isMd = /\.(md|markdown)$/i.test(found.name);
                pre.textContent = isMd ? lighten(r.content) : r.content;
            }

            load();
            const iv = setInterval(() => { if (cwd() !== lastDir) load(); }, 3000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
