"use strict";
window.I18N.register({
    en: { "widget.p2_timetracker": "Time Tracker", "cat.productivity": "Productivity" },
    ru: { "widget.p2_timetracker": "Учёт времени", "cat.productivity": "Продуктивность" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.p2_timetracker = {
    id: "p2_timetracker",
    title: "widget.p2_timetracker",
    category: "productivity",
    description: "Start/stop tracking named tasks; logs durations and today's total",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const todayKey = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local
        const fmt = ms => {
            let s = Math.floor(ms / 1000);
            const h = Math.floor(s / 3600); s -= h * 3600;
            const m = Math.floor(s / 60); s -= m * 60;
            return (h ? h + "h " : "") + (h || m ? m + "m " : "") + s + "s";
        };
        let alive = true;
        let running = null; // {task, start}
        let logs = []; // {task, start, end, date}
        let tick = null;

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px">
                <div style="display:flex;gap:6px">
                    <input id="_tt_in" type="text" placeholder="Task name…"
                        style="flex:1;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:5px 8px;font-size:12px">
                    <button id="_tt_go" style="background:var(--accent);border:none;color:#fff;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:12px">Start</button>
                </div>
                <div id="_tt_now" style="font-size:12px;color:var(--text-dim)"></div>
                <div id="_tt_total" style="font-size:12px;color:var(--accent2);font-variant-numeric:tabular-nums"></div>
                <div id="_tt_list" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:2px;font-family:var(--font-mono);font-size:11px"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        const input = $("#_tt_in"), goBtn = $("#_tt_go"), nowEl = $("#_tt_now"), totalEl = $("#_tt_total"), listEl = $("#_tt_list");

        const save = () => window.dyo.settings.set({ "p2.timetracker": { running, logs: logs.slice(-500) } });

        const todayTotals = () => {
            const tk = todayKey();
            const map = {};
            let total = 0;
            logs.filter(l => l.date === tk).forEach(l => {
                const d = l.end - l.start;
                map[l.task] = (map[l.task] || 0) + d;
                total += d;
            });
            if (running && running.start) {
                const d = Date.now() - running.start;
                map[running.task] = (map[running.task] || 0) + d;
                total += d;
            }
            return { map, total };
        };

        const render = () => {
            if (running) {
                goBtn.textContent = "Stop";
                goBtn.style.background = "var(--danger)";
                nowEl.textContent = `▶ ${running.task} — ${fmt(Date.now() - running.start)}`;
                input.value = running.task;
                input.disabled = true;
            } else {
                goBtn.textContent = "Start";
                goBtn.style.background = "var(--accent)";
                nowEl.textContent = "Idle";
                input.disabled = false;
            }
            const { map, total } = todayTotals();
            totalEl.textContent = `Today total: ${fmt(total)}`;
            const keys = Object.keys(map).sort((a, b) => map[b] - map[a]);
            listEl.innerHTML = keys.length
                ? keys.slice(0, 200).map(k => `<div style="display:flex;gap:8px;padding:2px 4px;border-bottom:1px solid var(--border)"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)">${esc(k)}</span><span style="color:var(--text-dim)">${esc(fmt(map[k]))}</span></div>`).join("")
                : `<div style="color:var(--text-dim);padding:4px">No entries today.</div>`;
        };

        const toggle = () => {
            if (running) {
                logs.push({ task: running.task, start: running.start, end: Date.now(), date: todayKey() });
                running = null;
            } else {
                const t = input.value.trim();
                if (!t) return;
                running = { task: t, start: Date.now() };
            }
            save(); render();
        };
        goBtn.onclick = toggle;
        input.addEventListener("keydown", e => { if (e.key === "Enter" && !running) toggle(); });

        tick = setInterval(() => { if (alive && running) render(); }, 1000);

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            const stored = s && s["p2.timetracker"];
            if (stored && typeof stored === "object") {
                logs = Array.isArray(stored.logs) ? stored.logs.filter(l => l && typeof l.task === "string" && l.start && l.end) : [];
                running = stored.running && typeof stored.running.task === "string" && stored.running.start ? stored.running : null;
            }
            render();
        }).catch(() => { if (alive) render(); });

        return { destroy: () => { alive = false; clearInterval(tick); } };
    }
};
