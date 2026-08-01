"use strict";
window.I18N.register({
    en: { "widget.snippets": "Snippets", "cat.terminal": "Terminal" },
    ru: { "widget.snippets": "Сниппеты", "cat.terminal": "Терминал" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.snippets = {
    id: "snippets",
    title: "widget.snippets",
    category: "terminal",
    description: "Saved command snippets: run or copy",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        let snippets = [];

        body.innerHTML = `<div id="_sn_list" style="display:flex;flex-wrap:wrap;gap:6px;align-content:flex-start;height:100%;overflow:auto"></div>`;
        const list = body.querySelector("#_sn_list");

        const save = () => window.dyo.settings.set({ "term.snippets": snippets });

        function render() {
            list.innerHTML = "";
            snippets.forEach((s, i) => {
                const wrap = document.createElement("div");
                wrap.style.cssText = "display:inline-flex;align-items:stretch;border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--bg-elevated)";

                const runB = document.createElement("button");
                runB.textContent = s.label;
                runB.title = s.command + "\n(right-click to remove)";
                runB.style.cssText = "border:0;background:transparent;color:var(--text);padding:6px 10px;cursor:pointer;font-family:var(--font-ui);font-size:12px";
                runB.onclick = () => { if (window.term) window.term.runInFocused(s.command.endsWith("\n") ? s.command : s.command + "\n"); };
                runB.oncontextmenu = (e) => { e.preventDefault(); snippets.splice(i, 1); save(); render(); };

                const copyB = document.createElement("button");
                copyB.textContent = "⧉";
                copyB.title = "Copy command";
                copyB.style.cssText = "border:0;border-left:1px solid var(--border);background:transparent;color:var(--text-dim);padding:6px 8px;cursor:pointer;font-size:12px";
                copyB.onclick = (e) => { e.stopPropagation(); navigator.clipboard.writeText(s.command).catch(() => {}); };

                wrap.appendChild(runB);
                wrap.appendChild(copyB);
                list.appendChild(wrap);
            });

            const add = document.createElement("button");
            add.textContent = "+";
            add.title = "Add snippet";
            add.style.cssText = "border:1px dashed var(--border-strong,var(--border));background:transparent;color:var(--accent);border-radius:8px;padding:6px 12px;cursor:pointer;font-size:14px";
            add.onclick = () => {
                const label = prompt("Snippet label:");
                if (!label) return;
                const command = prompt("Command:");
                if (!command) return;
                snippets.push({ label, command });
                save(); render();
            };
            list.appendChild(add);
        }

        window.dyo.settings.get().then(s => {
            const stored = s ? s["term.snippets"] : null;
            snippets = Array.isArray(stored) ? stored : [
                { label: "git status", command: "git status" },
                { label: "list all", command: "ls -lah" }
            ];
            render();
        }).catch(() => { snippets = []; render(); });

        return { destroy: () => {} };
    }
};
