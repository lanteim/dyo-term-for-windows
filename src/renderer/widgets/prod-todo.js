"use strict";
window.I18N.register({
    en: { "widget.prod-todo": "To-Do List", "cat.productivity": "Productivity" },
    ru: { "widget.prod-todo": "Список дел", "cat.productivity": "Продуктивность" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS["prod-todo"] = {
    id: "prod-todo",
    title: "widget.prod-todo",
    category: "productivity",
    description: "Persistent checklist stored in settings",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px">
                <div style="display:flex;gap:6px">
                    <input id="_td_in" type="text" placeholder="Add a task…"
                        style="flex:1;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:5px 8px;font-size:12px">
                    <button id="_td_add" style="background:var(--accent);border:none;color:#fff;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:12px">Add</button>
                </div>
                <div id="_td_list" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:3px"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        const listEl = $("#_td_list"), input = $("#_td_in");
        let items = [];
        let alive = true;

        const save = () => { window.dyo.settings.set({ "prod.todo": items }); };

        const render = () => {
            listEl.innerHTML = "";
            if (!items.length) {
                listEl.innerHTML = `<div style="color:var(--text-dim);font-size:12px;padding:4px 2px">No tasks yet.</div>`;
                return;
            }
            items.forEach((it, idx) => {
                const row = document.createElement("div");
                row.style.cssText = "display:flex;align-items:center;gap:8px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;background:var(--bg-elevated)";
                const cb = document.createElement("input");
                cb.type = "checkbox"; cb.checked = !!it.done; cb.style.cursor = "pointer";
                cb.onchange = () => { items[idx].done = cb.checked; save(); render(); };
                const label = document.createElement("span");
                label.textContent = it.text;
                label.style.cssText = "flex:1;font-size:12px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" +
                    (it.done ? ";text-decoration:line-through;color:var(--text-dim)" : "");
                const del = document.createElement("button");
                del.textContent = "×";
                del.title = "Remove";
                del.style.cssText = "background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:16px;line-height:1;padding:0 4px";
                del.onclick = () => { items.splice(idx, 1); save(); render(); };
                row.appendChild(cb); row.appendChild(label); row.appendChild(del);
                listEl.appendChild(row);
            });
        };

        const add = () => {
            const text = input.value.trim();
            if (!text) return;
            items.push({ text, done: false });
            input.value = "";
            save(); render();
        };
        $("#_td_add").onclick = add;
        input.addEventListener("keydown", e => { if (e.key === "Enter") add(); });

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            const stored = s && s["prod.todo"];
            items = Array.isArray(stored) ? stored.filter(x => x && typeof x.text === "string").map(x => ({ text: x.text, done: !!x.done })) : [];
            render();
        }).catch(() => { if (alive) render(); });

        return { destroy: () => { alive = false; } };
    }
};
