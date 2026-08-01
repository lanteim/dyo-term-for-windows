"use strict";
window.I18N.register({
    en: { "widget.prod-calendar": "Calendar", "cat.productivity": "Productivity" },
    ru: { "widget.prod-calendar": "Календарь", "cat.productivity": "Продуктивность" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS["prod-calendar"] = {
    id: "prod-calendar",
    title: "widget.prod-calendar",
    category: "productivity",
    description: "Month grid calendar with today highlighted",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px">
                <div style="display:flex;align-items:center;justify-content:space-between">
                    <button id="_cal_prev" style="background:var(--bg-elevated);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:3px 10px;cursor:pointer;font-size:13px">‹</button>
                    <div id="_cal_title" style="font-size:13px;font-weight:500;color:var(--text);letter-spacing:1px"></div>
                    <button id="_cal_next" style="background:var(--bg-elevated);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:3px 10px;cursor:pointer;font-size:13px">›</button>
                </div>
                <div id="_cal_grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;flex:1"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        const grid = $("#_cal_grid"), title = $("#_cal_title");
        const now = new Date();
        let viewYear = now.getFullYear();
        let viewMonth = now.getMonth(); // 0-11
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const dow = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

        const render = () => {
            title.textContent = monthNames[viewMonth] + " " + viewYear;
            grid.innerHTML = "";
            dow.forEach(d => {
                const h = document.createElement("div");
                h.textContent = d;
                h.style.cssText = "text-align:center;font-size:10px;color:var(--text-dim);padding:2px 0;font-weight:600";
                grid.appendChild(h);
            });
            const first = new Date(viewYear, viewMonth, 1);
            // convert Sun(0)..Sat(6) to Mon-based offset 0..6
            let lead = (first.getDay() + 6) % 7;
            const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
            for (let i = 0; i < lead; i++) {
                grid.appendChild(document.createElement("div"));
            }
            const today = new Date();
            const isCurMonth = today.getFullYear() === viewYear && today.getMonth() === viewMonth;
            for (let day = 1; day <= daysInMonth; day++) {
                const cell = document.createElement("div");
                cell.textContent = String(day);
                const isToday = isCurMonth && today.getDate() === day;
                cell.style.cssText = "display:flex;align-items:center;justify-content:center;font-size:11.5px;border-radius:6px;" +
                    "font-variant-numeric:tabular-nums;color:var(--text);min-height:20px;" +
                    (isToday ? "background:var(--accent);color:#fff;font-weight:600" : "");
                grid.appendChild(cell);
            }
        };

        $("#_cal_prev").onclick = () => { viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } render(); };
        $("#_cal_next").onclick = () => { viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } render(); };
        render();
        return { destroy: () => {} };
    }
};
