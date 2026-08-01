"use strict";
window.I18N.register({
    en: { "widget.ref_vimcheat": "Vim Cheat-Sheet", "cat.reference": "Reference" },
    ru: { "widget.ref_vimcheat": "Vim шпаргалка", "cat.reference": "Справочник" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.ref_vimcheat = {
    id: "ref_vimcheat",
    title: "widget.ref_vimcheat",
    category: "reference",
    description: "Vim cheat-sheet, searchable; click to copy",
    defaultSize: { w: 8, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const DATA = [
            ["Modes & exit", [
                ["i", "Insert before cursor"],
                ["a", "Insert after cursor"],
                ["o", "Open new line below"],
                ["Esc", "Return to normal mode"],
                [":w", "Save file"],
                [":wq  /  ZZ", "Save and quit"],
                [":q!", "Quit without saving"]
            ]],
            ["Motion", [
                ["h j k l", "Left / down / up / right"],
                ["w  /  b", "Next / previous word start"],
                ["e", "Next word end"],
                ["0  /  ^  /  $", "Line start / first non-blank / end"],
                ["gg  /  G", "Top / bottom of file"],
                [":n", "Go to line n"],
                ["{  /  }", "Previous / next paragraph"],
                ["%", "Jump to matching bracket"]
            ]],
            ["Edit", [
                ["x", "Delete character"],
                ["dd", "Delete (cut) line"],
                ["dw", "Delete to next word"],
                ["yy", "Yank (copy) line"],
                ["p  /  P", "Paste after / before"],
                ["r<char>", "Replace one character"],
                ["cw", "Change word"],
                ["u  /  C-r", "Undo / redo"],
                [".", "Repeat last change"]
            ]],
            ["Visual", [
                ["v", "Character-wise visual"],
                ["V", "Line-wise visual"],
                ["C-v", "Block-wise visual"],
                ["> / <", "Indent / unindent selection"]
            ]],
            ["Search & replace", [
                ["/pattern", "Search forward"],
                ["?pattern", "Search backward"],
                ["n  /  N", "Next / previous match"],
                ["*", "Search word under cursor"],
                [":%s/old/new/g", "Replace all in file"],
                [":%s/old/new/gc", "Replace all, confirm each"]
            ]],
            ["Files & windows", [
                [":e file", "Open a file"],
                [":sp / :vsp", "Split horizontally / vertically"],
                ["C-w w", "Cycle windows"],
                [":bn / :bp", "Next / previous buffer"],
                [":noh", "Clear search highlight"]
            ]]
        ];
        window.__refCheatRender(body, DATA, esc, "Search vim keys…");
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
