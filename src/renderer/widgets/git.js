"use strict";
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.git = {
    id: "git",
    title: "widget.git",
    category: "git",
    description: "Branch, changes, ahead/behind, stash",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        body.innerHTML = `
            <div class="metric-row"><span class="k">🌿 BRANCH</span><span class="v"><b id="_git_b">—</b></span></div>
            <div class="metric-row"><span class="k">CHANGES</span><span class="v" id="_git_c">—</span></div>
            <div class="metric-row"><span class="k">AHEAD / BEHIND</span><span class="v" id="_git_ab">—</span></div>
            <div class="metric-row"><span class="k">STASH</span><span class="v" id="_git_s">—</span></div>
            <div id="_git_repo" style="color:var(--text-dim);font-size:11px;margin-top:6px">loading…</div>`;
        const $ = s => body.querySelector(s);
        let alive = true;
        const git = (args) => window.dyo.exec("git", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 5000 });
        const tick = async () => {
            if (!alive) return;
            try {
                const inside = await git(["rev-parse", "--is-inside-work-tree"]);
                if (!inside || inside.code !== 0 || (inside.stdout || "").trim() !== "true") {
                    $("#_git_b").textContent = "—";
                    $("#_git_repo").textContent = "not a git repository";
                    $("#_git_c").textContent = $("#_git_ab").textContent = $("#_git_s").textContent = "—";
                    return;
                }
                const [branch, status, stash, ab, top] = await Promise.all([
                    git(["rev-parse", "--abbrev-ref", "HEAD"]),
                    git(["status", "--porcelain"]),
                    git(["stash", "list"]),
                    git(["rev-list", "--count", "--left-right", "@{u}...HEAD"]),
                    git(["rev-parse", "--show-toplevel"])
                ]);
                $("#_git_b").textContent = (branch.stdout || "").trim() || "—";
                const changed = (status.stdout || "").split("\n").filter(l => l.trim()).length;
                $("#_git_c").textContent = changed ? changed + " file" + (changed > 1 ? "s" : "") : "clean";
                $("#_git_c").style.color = changed ? "var(--accent)" : "var(--accent2)";
                $("#_git_s").textContent = (stash.stdout || "").split("\n").filter(l => l.trim()).length;
                if (ab && ab.code === 0 && (ab.stdout || "").trim()) {
                    const [behind, ahead] = ab.stdout.trim().split(/\s+/);
                    $("#_git_ab").textContent = `↑${ahead} ↓${behind}`;
                } else $("#_git_ab").textContent = "no upstream";
                $("#_git_repo").textContent = (top.stdout || "").trim().split("/").pop() || "—";
            } catch (e) {
                $("#_git_repo").textContent = "error reading git";
            }
        };
        tick();
        const iv = setInterval(tick, 4000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
