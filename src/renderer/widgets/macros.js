"use strict";
window.WIDGETS = window.WIDGETS || {};

function escM(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}

window.WIDGETS.macros = {
    id: "macros",
    title: "widget.macros",
    category: "terminal",
    description: "Buttons that run your commands",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        let macros = [];
        window.dyo.settings.get().then(s => { macros = Array.isArray(s.macros) ? s.macros : [
            { label: "git status", command: "git status\n" },
            { label: "ll", command: "ls -lah\n" }
        ]; render(); });

        body.innerHTML = `<div class="macro-list" style="display:flex;flex-wrap:wrap;gap:6px;align-content:flex-start;height:100%;overflow:auto"></div>`;
        const list = body.querySelector(".macro-list");
        const save = () => window.dyo.settings.set({ macros });

        function render() {
            list.innerHTML = "";
            macros.forEach((m, i) => {
                const b = document.createElement("button");
                b.textContent = m.label;
                b.title = m.command;
                b.style.cssText = "border:1px solid var(--border);background:var(--bg-elevated);color:var(--text);border-radius:8px;padding:6px 10px;cursor:pointer;font-family:var(--font-ui);font-size:12px";
                b.onclick = () => { if (window.term) window.term.runInFocused(m.command.endsWith("\n") ? m.command : m.command + "\n"); };
                b.oncontextmenu = (e) => { e.preventDefault(); macros.splice(i, 1); save(); render(); };
                list.appendChild(b);
            });
            const add = document.createElement("button");
            add.textContent = "+";
            add.title = "Add macro";
            add.style.cssText = "border:1px dashed var(--border-strong);background:transparent;color:var(--accent);border-radius:8px;padding:6px 12px;cursor:pointer";
            add.onclick = () => {
                const label = prompt("Macro label:");
                if (!label) return;
                const command = prompt("Command to run:");
                if (!command) return;
                macros.push({ label, command });
                save(); render();
            };
            list.appendChild(add);
        }
        return { destroy: () => {} };
    }
};
