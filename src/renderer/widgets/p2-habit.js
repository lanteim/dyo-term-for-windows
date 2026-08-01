"use strict";
window.I18N.register({
    en: { "widget.p2_habit": "Habit Tracker", "cat.productivity": "Productivity" },
    ru: { "widget.p2_habit": "Трекер привычек", "cat.productivity": "Продуктивность" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.p2_habit = {
    id: "p2_habit",
    title: "widget.p2_habit",
    category: "productivity",
    description: "Weekly habit grid; tap days done, tracks current streak",
    defaultSize: { w: 8, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        // day key relative to Monday=0 week
        const dayKey = d => d.toLocaleDateString("en-CA");
        const startOfWeek = () => {
            const d = new Date();
            const wd = (d.getDay() + 6) % 7; // Mon=0
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() - wd);
            return d;
        };
        const weekDates = () => {
            const s = startOfWeek();
            return DAYS.map((_, i) => { const x = new Date(s); x.setDate(s.getDate() + i); return dayKey(x); });
        };
        let alive = true;
        let habits = []; // {id, name, done:{ 'YYYY-MM-DD': true }}

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px">
                <div style="display:flex;gap:6px">
                    <input id="_hb_in" type="text" placeholder="New habit…"
                        style="flex:1;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:5px 8px;font-size:12px">
                    <button id="_hb_add" style="background:var(--accent);border:none;color:#fff;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:12px">Add</button>
                </div>
                <div id="_hb_grid" style="flex:1;overflow:auto"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        const input = $("#_hb_in"), gridEl = $("#_hb_grid");

        const save = () => window.dyo.settings.set({ "p2.habit": habits });

        const streakOf = (h) => {
            // count consecutive days done ending today (or yesterday)
            let streak = 0;
            const d = new Date(); d.setHours(0, 0, 0, 0);
            if (!h.done[dayKey(d)]) d.setDate(d.getDate() - 1); // allow streak to hold if today not yet done
            while (h.done[dayKey(d)]) { streak++; d.setDate(d.getDate() - 1); }
            return streak;
        };

        const render = () => {
            const wd = weekDates();
            const tk = dayKey(new Date());
            gridEl.innerHTML = "";
            if (!habits.length) {
                gridEl.innerHTML = `<div style="color:var(--text-dim);font-size:12px;padding:4px 2px">No habits yet. Add one above.</div>`;
                return;
            }
            const table = document.createElement("table");
            table.style.cssText = "width:100%;border-collapse:collapse;font-size:11px";
            const thead = document.createElement("tr");
            thead.innerHTML = `<th style="text-align:left;color:var(--text-dim);font-weight:500;padding:2px 4px"></th>` +
                DAYS.map((d, i) => `<th style="color:${wd[i] === tk ? "var(--accent)" : "var(--text-dim)"};font-weight:500;padding:2px 2px;width:30px">${esc(d)}</th>`).join("") +
                `<th style="color:var(--accent2);font-weight:500;padding:2px 4px">🔥</th><th></th>`;
            table.appendChild(thead);
            habits.forEach((h, hi) => {
                const tr = document.createElement("tr");
                tr.style.borderTop = "1px solid var(--border)";
                const nameTd = document.createElement("td");
                nameTd.textContent = h.name;
                nameTd.style.cssText = "color:var(--text);padding:4px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
                tr.appendChild(nameTd);
                wd.forEach(dk => {
                    const td = document.createElement("td");
                    td.style.cssText = "text-align:center;padding:2px";
                    const cell = document.createElement("button");
                    const on = !!h.done[dk];
                    cell.style.cssText = `width:22px;height:22px;border-radius:5px;cursor:pointer;border:1px solid var(--border);background:${on ? "var(--accent2)" : "var(--bg-elevated)"};color:${on ? "#000" : "var(--text-dim)"};font-size:12px;line-height:1`;
                    cell.textContent = on ? "✓" : "";
                    cell.onclick = () => { if (on) delete h.done[dk]; else h.done[dk] = true; save(); render(); };
                    td.appendChild(cell);
                    tr.appendChild(td);
                });
                const stTd = document.createElement("td");
                stTd.textContent = String(streakOf(h));
                stTd.style.cssText = "text-align:center;color:var(--accent2);font-variant-numeric:tabular-nums;padding:4px";
                tr.appendChild(stTd);
                const delTd = document.createElement("td");
                const del = document.createElement("button");
                del.textContent = "×"; del.title = "Remove habit";
                del.style.cssText = "background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:15px;line-height:1;padding:0 4px";
                del.onclick = () => { habits.splice(hi, 1); save(); render(); };
                delTd.appendChild(del);
                tr.appendChild(delTd);
                table.appendChild(tr);
            });
            gridEl.appendChild(table);
        };

        const add = () => {
            const name = input.value.trim();
            if (!name) return;
            habits.push({ id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), name, done: {} });
            input.value = "";
            save(); render();
        };
        $("#_hb_add").onclick = add;
        input.addEventListener("keydown", e => { if (e.key === "Enter") add(); });

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            const stored = s && s["p2.habit"];
            habits = Array.isArray(stored)
                ? stored.filter(x => x && typeof x.name === "string").map(x => ({
                    id: x.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
                    name: x.name,
                    done: (x.done && typeof x.done === "object") ? x.done : {}
                }))
                : [];
            render();
        }).catch(() => { if (alive) render(); });

        return { destroy: () => { alive = false; } };
    }
};
