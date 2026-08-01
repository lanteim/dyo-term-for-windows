"use strict";
window.I18N.register({
    en: { "widget.p2_kanban": "Kanban Board", "cat.productivity": "Productivity" },
    ru: { "widget.p2_kanban": "Канбан-доска", "cat.productivity": "Продуктивность" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.p2_kanban = {
    id: "p2_kanban",
    title: "widget.p2_kanban",
    category: "productivity",
    description: "Three-column TODO/DOING/DONE board, cards persisted to settings",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const COLS = [
            { key: "todo", label: "TODO", color: "var(--text-dim)" },
            { key: "doing", label: "DOING", color: "var(--accent)" },
            { key: "done", label: "DONE", color: "var(--accent2)" }
        ];
        let alive = true;
        let cards = []; // {id, text, col}

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px">
                <div style="display:flex;gap:6px">
                    <input id="_kb_in" type="text" placeholder="New card → TODO…"
                        style="flex:1;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:5px 8px;font-size:12px">
                    <button id="_kb_add" style="background:var(--accent);border:none;color:#fff;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:12px">Add</button>
                </div>
                <div id="_kb_cols" style="flex:1;display:flex;gap:8px;overflow:hidden"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        const input = $("#_kb_in"), colsEl = $("#_kb_cols");

        const save = () => window.dyo.settings.set({ "p2.kanban": cards });
        const move = (id, dir) => {
            const c = cards.find(x => x.id === id);
            if (!c) return;
            const i = COLS.findIndex(x => x.key === c.col);
            const ni = i + dir;
            if (ni < 0 || ni >= COLS.length) return;
            c.col = COLS[ni].key;
            save(); render();
        };
        const del = (id) => { cards = cards.filter(x => x.id !== id); save(); render(); };

        const render = () => {
            colsEl.innerHTML = "";
            COLS.forEach((col, ci) => {
                const colEl = document.createElement("div");
                colEl.style.cssText = "flex:1;display:flex;flex-direction:column;gap:4px;min-width:0;overflow:hidden";
                const head = document.createElement("div");
                const items = cards.filter(c => c.col === col.key);
                head.style.cssText = `font-size:11px;font-weight:600;color:${col.color};padding:2px 4px;border-bottom:1px solid var(--border)`;
                head.textContent = `${col.label} (${items.length})`;
                colEl.appendChild(head);
                const listEl = document.createElement("div");
                listEl.style.cssText = "flex:1;overflow:auto;display:flex;flex-direction:column;gap:4px;padding-top:2px";
                items.slice(0, 200).forEach(c => {
                    const card = document.createElement("div");
                    card.style.cssText = "background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;padding:5px 6px;display:flex;flex-direction:column;gap:4px";
                    const txt = document.createElement("div");
                    txt.textContent = c.text;
                    txt.style.cssText = "font-size:12px;color:var(--text);word-break:break-word";
                    const bar = document.createElement("div");
                    bar.style.cssText = "display:flex;gap:4px;align-items:center";
                    const mk = (label, dir, disabled) => {
                        const b = document.createElement("button");
                        b.textContent = label;
                        b.title = dir < 0 ? "Move left" : "Move right";
                        b.setAttribute("aria-label", b.title);
                        b.disabled = disabled;
                        b.style.cssText = "background:none;border:1px solid var(--border);color:var(--text);border-radius:4px;padding:1px 6px;font-size:11px;cursor:pointer" + (disabled ? ";opacity:.3;cursor:default" : "");
                        if (!disabled) b.onclick = () => move(c.id, dir);
                        return b;
                    };
                    bar.appendChild(mk("◀", -1, ci === 0));
                    bar.appendChild(mk("▶", 1, ci === COLS.length - 1));
                    const x = document.createElement("button");
                    x.textContent = "×"; x.title = "Delete";
                    x.style.cssText = "margin-left:auto;background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:15px;line-height:1;padding:0 4px";
                    x.onclick = () => del(c.id);
                    bar.appendChild(x);
                    card.appendChild(txt); card.appendChild(bar);
                    listEl.appendChild(card);
                });
                if (!items.length) {
                    const empty = document.createElement("div");
                    empty.style.cssText = "font-size:11px;color:var(--text-dim);padding:4px";
                    empty.textContent = "—";
                    listEl.appendChild(empty);
                }
                colEl.appendChild(listEl);
                colsEl.appendChild(colEl);
            });
        };

        const add = () => {
            const text = input.value.trim();
            if (!text) return;
            cards.push({ id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())), text, col: "todo" });
            input.value = "";
            save(); render();
        };
        $("#_kb_add").onclick = add;
        input.addEventListener("keydown", e => { if (e.key === "Enter") add(); });

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            const stored = s && s["p2.kanban"];
            cards = Array.isArray(stored)
                ? stored.filter(x => x && typeof x.text === "string").map(x => ({
                    id: x.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
                    text: x.text,
                    col: ["todo", "doing", "done"].includes(x.col) ? x.col : "todo"
                }))
                : [];
            render();
        }).catch(() => { if (alive) render(); });

        return { destroy: () => { alive = false; } };
    }
};
