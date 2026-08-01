"use strict";
window.I18N.register({
    en: { "widget.p2_countdown": "Countdown", "cat.productivity": "Productivity" },
    ru: { "widget.p2_countdown": "Обратный отсчёт", "cat.productivity": "Продуктивность" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.p2_countdown = {
    id: "p2_countdown",
    title: "widget.p2_countdown",
    category: "productivity",
    description: "Countdown to a saved date/event; days and hours remaining",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        let alive = true;
        let event = { name: "", date: "" }; // date = YYYY-MM-DD
        let tick = null;

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px">
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                    <input id="_cd_name" type="text" placeholder="Event name…"
                        style="flex:1;min-width:100px;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:5px 8px;font-size:12px">
                    <input id="_cd_date" type="date"
                        style="background:var(--bg-elevated);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:5px 8px;font-size:12px">
                    <button id="_cd_save" style="background:var(--accent);border:none;color:#fff;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:12px">Save</button>
                </div>
                <div id="_cd_out" style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        const nameIn = $("#_cd_name"), dateIn = $("#_cd_date"), outEl = $("#_cd_out");

        const save = () => window.dyo.settings.set({ "p2.countdown": event });

        const render = () => {
            if (!event.date) {
                outEl.innerHTML = `<div style="color:var(--text-dim);font-size:12px">Set a date above to start the countdown.</div>`;
                return;
            }
            // target = local midnight of the chosen date
            const parts = event.date.split("-").map(Number);
            const target = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1, 0, 0, 0, 0).getTime();
            const now = Date.now();
            let diff = target - now;
            const nm = event.name || "Event";
            if (diff <= 0) {
                const past = Math.floor(-diff / 86400000);
                outEl.innerHTML = `<div style="font-size:14px;color:var(--accent2);font-weight:600">${esc(nm)} ${past === 0 ? "is today! 🎉" : "was " + past + "d ago"}</div>`;
                return;
            }
            const days = Math.floor(diff / 86400000); diff -= days * 86400000;
            const hours = Math.floor(diff / 3600000); diff -= hours * 3600000;
            const mins = Math.floor(diff / 60000);
            outEl.innerHTML = `
                <div style="font-size:12px;color:var(--text-dim);margin-bottom:4px">${esc(nm)}</div>
                <div style="font-size:22px;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums">${days}d ${String(hours).padStart(2, "0")}h ${String(mins).padStart(2, "0")}m</div>
                <div style="font-size:11px;color:var(--text-dim);margin-top:4px">${esc(event.date)}</div>`;
        };

        $("#_cd_save").onclick = () => {
            event = { name: nameIn.value.trim(), date: dateIn.value };
            save(); render();
        };
        nameIn.addEventListener("keydown", e => { if (e.key === "Enter") $("#_cd_save").click(); });

        tick = setInterval(() => { if (alive) render(); }, 30000);

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            const stored = s && s["p2.countdown"];
            if (stored && typeof stored === "object") {
                event = { name: String(stored.name || ""), date: /^\d{4}-\d{2}-\d{2}$/.test(stored.date) ? stored.date : "" };
            }
            nameIn.value = event.name;
            dateIn.value = event.date;
            render();
        }).catch(() => { if (alive) render(); });

        return { destroy: () => { alive = false; clearInterval(tick); } };
    }
};
