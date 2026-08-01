"use strict";
window.I18N.register({
    en: { "widget.gitremote": "Branch & Remote", "cat.git": "Git" },
    ru: { "widget.gitremote": "Ветка и remote", "cat.git": "Git" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.gitremote = {
    id: "gitremote",
    title: "widget.gitremote",
    category: "git",
    description: "Branch, upstream, last fetch; fetch/pull buttons",
    defaultSize: { w: 6, h: 2 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">BRANCH</span><span class="v"><b id="_gr_b">—</b> <span id="_gr_ab" style="color:var(--text-dim)"></span></span></div>
            <div class="metric-row"><span class="k">UPSTREAM</span><span class="v" id="_gr_up">—</span></div>
            <div class="metric-row"><span class="k">LAST FETCH</span><span class="v" id="_gr_lf">—</span></div>
            <div id="_gr_btns" style="display:flex;gap:8px;margin-top:8px">
                <button id="_gr_fetch">git fetch</button>
                <button id="_gr_pull">git pull</button>
            </div>`;
        const $ = s => body.querySelector(s);
        body.querySelectorAll("#_gr_btns button").forEach(b => b.style.cssText = "border:1px solid var(--border);background:transparent;color:var(--text);border-radius:8px;padding:5px 12px;cursor:pointer;font-family:var(--font-ui);font-size:12px");
        body.querySelectorAll("#_gr_btns button").forEach(b => {
            b.onmouseenter = () => { b.style.borderColor = "var(--accent)"; b.style.color = "var(--accent)"; };
            b.onmouseleave = () => { b.style.borderColor = "var(--border)"; b.style.color = "var(--text)"; };
        });
        let alive = true, busy = false;
        const git = (args) => window.dyo.exec("git", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 6000 });

        $("#_gr_fetch").onclick = () => { if (window.term && window.term.runInFocused) window.term.runInFocused("git fetch\n"); };
        $("#_gr_pull").onclick = () => { if (window.term && window.term.runInFocused) window.term.runInFocused("git pull\n"); };

        const setNA = (msg) => {
            $("#_gr_b").textContent = "—";
            $("#_gr_ab").textContent = "";
            $("#_gr_up").textContent = msg || "—";
            $("#_gr_lf").textContent = "—";
        };

        const fmtAge = (ms) => {
            const s = Math.max(0, Math.floor(ms / 1000));
            if (s < 60) return s + "s ago";
            const m = Math.floor(s / 60); if (m < 60) return m + "m ago";
            const h = Math.floor(m / 60); if (h < 24) return h + "h ago";
            return Math.floor(h / 24) + "d ago";
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const inside = await git(["rev-parse", "--is-inside-work-tree"]);
                if (!inside || inside.code !== 0 || inside.stdout.trim() !== "true") {
                    setNA("not a git repository");
                    return;
                }
                const [branch, up, ab, gitdir] = await Promise.all([
                    git(["rev-parse", "--abbrev-ref", "HEAD"]),
                    git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]),
                    git(["rev-list", "--count", "--left-right", "@{u}...HEAD"]),
                    git(["rev-parse", "--git-dir"])
                ]);
                $("#_gr_b").textContent = (branch.stdout || "").trim() || "—";
                if (up && up.code === 0 && up.stdout.trim()) {
                    $("#_gr_up").textContent = up.stdout.trim();
                    $("#_gr_up").style.color = "var(--text)";
                    if (ab && ab.code === 0 && ab.stdout.trim()) {
                        const [behind, ahead] = ab.stdout.trim().split(/\s+/);
                        $("#_gr_ab").textContent = `↑${ahead} ↓${behind}`;
                    } else $("#_gr_ab").textContent = "";
                } else {
                    $("#_gr_up").textContent = "no upstream";
                    $("#_gr_up").style.color = "var(--text-dim)";
                    $("#_gr_ab").textContent = "";
                }
                // last fetch = mtime of FETCH_HEAD
                let lf = "never";
                if (gitdir && gitdir.code === 0) {
                    const dir = gitdir.stdout.trim();
                    // resolve relative git dir against cwd
                    const base = window.term ? window.term.lastCwd : "";
                    const path = (dir.startsWith("/") ? dir : (base ? base.replace(/\/$/, "") + "/" + dir : dir)) + "/FETCH_HEAD";
                    const st = await window.dyo.fs.stat(path);
                    if (st && !st.error && st.mtimeMs) lf = fmtAge(Date.now() - st.mtimeMs);
                }
                $("#_gr_lf").textContent = lf;
            } catch (e) {
                setNA("error");
            } finally {
                busy = false;
            }
        };
        tick();
        const iv = setInterval(tick, 5000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
