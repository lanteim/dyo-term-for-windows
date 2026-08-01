"use strict";
window.I18N.register({
    en: { "widget.p2_dailygoals": "Daily Goals", "cat.productivity": "Productivity" },
    ru: { "widget.p2_dailygoals": "Цели дня", "cat.productivity": "Продуктивность" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.p2_dailygoals = {
    id: "p2_dailygoals",
    title: "widget.p2_dailygoals",
    category: "productivity",
    description: "Daily checklist that auto-resets each day; persisted with date",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const todayKey = () => new Date().toLocaleDateString("en-CA");
        let alive = true;
        let date = todayKey();
        let items = []; // {text, done}
        let dayTimer = null;

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px">
                <div style="display:flex;align-items:center;gap:8px">
                    <span id="_dg_date" style="font-size:11px;color:var(--text-dim)"></span>
                    <span id="_dg_prog" style="margin-left:auto;font-size:11px;color:var(--accent2);font-variant-numeric:tabular-nums"></span>
                </div>
                <div style="display:flex;gap:6px">
                    <input id="_dg_in" type="text" placeholder="Add goal for today…"
                        style="flex:1;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:5px 8px;font-size:12px">
                    <button id="_dg_add" style="background:var(--accent);border:none;color:#fff;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:12px">Add</button>
                </div>
                <div id="_dg_list" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:3px"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        const input = $("#_dg_in"), listEl = $("#_dg_list"), dateEl = $("#_dg_date"), progEl = $("#_dg_prog");

        const save = () => window.dyo.settings.set({ "p2.dailygoals": { date, items } });

        const checkDay = () => {
            const tk = todayKey();
            if (tk !== date) {
                date = tk;
                items = items.map(it => ({ text: it.text, done: false })); // keep goals as template, reset done
                save();
                render();
            }
        };

        const render = () => {
            dateEl.textContent = date;
            const done = items.filter(i => i.done).length;
            progEl.textContent = items.length ? `${done}/${items.length} done` : "";
            listEl.innerHTML = "";
            if (!items.length) {
                listEl.innerHTML = `<div style="color:var(--text-dim);font-size:12px;padding:4px 2px">No goals yet for today.</div>`;
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
                del.textContent = "×"; del.title = "Remove";
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
        $("#_dg_add").onclick = add;
        input.addEventListener("keydown", e => { if (e.key === "Enter") add(); });

        dayTimer = setInterval(() => { if (alive) checkDay(); }, 60000);

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            const stored = s && s["p2.dailygoals"];
            if (stored && typeof stored === "object") {
                items = Array.isArray(stored.items) ? stored.items.filter(x => x && typeof x.text === "string").map(x => ({ text: x.text, done: !!x.done })) : [];
                date = typeof stored.date === "string" ? stored.date : todayKey();
            }
            checkDay();
            render();
        }).catch(() => { if (alive) render(); });

        return { destroy: () => { alive = false; clearInterval(dayTimer); } };
    }
};
