"use strict";
window.I18N.register({
    en: { "widget.ref_gitcheat": "Git Cheat-Sheet", "cat.reference": "Reference" },
    ru: { "widget.ref_gitcheat": "Git шпаргалка", "cat.reference": "Справочник" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.ref_gitcheat = {
    id: "ref_gitcheat",
    title: "widget.ref_gitcheat",
    category: "reference",
    description: "Git command cheat-sheet, searchable; click to copy",
    defaultSize: { w: 8, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const DATA = [
            ["Setup", [
                ["git config --global user.name \"Name\"", "Set your commit name"],
                ["git config --global user.email you@example.com", "Set your commit email"],
                ["git init", "Create a new repository here"],
                ["git clone <url>", "Clone a remote repository"]
            ]],
            ["Basics", [
                ["git status", "Show working tree status"],
                ["git add -A", "Stage all changes"],
                ["git add -p", "Interactively stage hunks"],
                ["git commit -m \"msg\"", "Commit staged changes"],
                ["git commit --amend", "Amend the last commit"],
                ["git diff", "Unstaged changes"],
                ["git diff --staged", "Staged changes"]
            ]],
            ["Branches", [
                ["git branch", "List branches"],
                ["git switch -c <name>", "Create and switch to a branch"],
                ["git switch <name>", "Switch to a branch"],
                ["git merge <branch>", "Merge branch into current"],
                ["git rebase <branch>", "Rebase current onto branch"],
                ["git branch -d <name>", "Delete a merged branch"]
            ]],
            ["Remote", [
                ["git remote -v", "List remotes"],
                ["git fetch --all --prune", "Fetch and prune deleted refs"],
                ["git pull --rebase", "Pull rebasing local commits"],
                ["git push", "Push current branch"],
                ["git push -u origin <branch>", "Push and set upstream"],
                ["git push --force-with-lease", "Safe force push"]
            ]],
            ["Undo", [
                ["git restore <file>", "Discard working changes"],
                ["git restore --staged <file>", "Unstage a file"],
                ["git reset --soft HEAD~1", "Undo commit, keep changes staged"],
                ["git reset --hard HEAD", "Discard all local changes"],
                ["git revert <commit>", "Create a commit that undoes another"],
                ["git clean -fd", "Delete untracked files & dirs"]
            ]],
            ["Inspect", [
                ["git log --oneline --graph --all", "Compact branch graph"],
                ["git log -p <file>", "History with diffs for a file"],
                ["git blame <file>", "Who changed each line"],
                ["git show <commit>", "Show a commit"],
                ["git reflog", "History of HEAD movements"]
            ]],
            ["Stash", [
                ["git stash", "Stash working changes"],
                ["git stash -u", "Stash including untracked"],
                ["git stash pop", "Apply and drop latest stash"],
                ["git stash list", "List stashes"]
            ]]
        ];
        window.__refCheatRender(body, DATA, esc, "Search git commands…");
        return { destroy: () => body._cheatCleanup && body._cheatCleanup() };
    }
};

window.__refCheatRender = window.__refCheatRender || function (body, DATA, esc, placeholder) {
    body.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%;gap:6px">
          <input class="_ch_q" placeholder="${esc(placeholder)}" style="width:100%;box-sizing:border-box;background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 8px;font-family:var(--font-mono);font-size:12px">
          <div class="_ch_toast" style="height:14px;font-size:10.5px;color:var(--accent2)"></div>
          <div class="_ch_list" style="overflow:auto;flex:1"></div>
        </div>`;
    const q = body.querySelector("._ch_q");
    const list = body.querySelector("._ch_list");
    const toast = body.querySelector("._ch_toast");
    let toastT = null;
    const render = () => {
        const s = q.value.trim().toLowerCase();
        let html = "";
        DATA.forEach(([sec, items]) => {
            const rows = items.filter(([cmd, desc]) => !s || cmd.toLowerCase().includes(s) || desc.toLowerCase().includes(s));
            if (!rows.length) return;
            html += `<div style="font-size:10.5px;text-transform:uppercase;letter-spacing:1px;color:var(--text-dim);margin:8px 0 4px">${esc(sec)}</div>`;
            html += rows.map(([cmd, desc]) => `<div class="_ch_item" data-cmd="${esc(cmd)}" title="Click to copy" style="cursor:pointer;padding:4px 8px;border:1px solid var(--border);border-radius:6px;margin-bottom:4px;background:var(--bg-elevated)">
                <div style="font-family:var(--font-mono);font-size:11.5px;color:var(--accent)">${esc(cmd)}</div>
                <div style="font-size:11px;color:var(--text-dim);margin-top:1px">${esc(desc)}</div></div>`).join("");
        });
        list.innerHTML = html || `<div style="color:var(--text-dim);font-size:12px;padding:8px">No matches.</div>`;
    };
    const onClick = e => {
        const it = e.target.closest("._ch_item");
        if (!it) return;
        const cmd = it.dataset.cmd;
        navigator.clipboard.writeText(cmd).then(() => {
            toast.textContent = "Copied: " + cmd;
            clearTimeout(toastT);
            toastT = setTimeout(() => { toast.textContent = ""; }, 1600);
        }).catch(() => { toast.textContent = "Copy failed"; });
    };
    q.addEventListener("input", render);
    list.addEventListener("click", onClick);
    render();
    body._cheatCleanup = () => {
        q.removeEventListener("input", render);
        list.removeEventListener("click", onClick);
        clearTimeout(toastT);
    };
};
