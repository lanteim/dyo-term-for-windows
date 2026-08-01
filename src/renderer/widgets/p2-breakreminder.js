"use strict";
window.I18N.register({
    en: { "widget.p2_breakreminder": "Break Reminder", "cat.productivity": "Productivity" },
    ru: { "widget.p2_breakreminder": "Напоминание о перерыве", "cat.productivity": "Продуктивность" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.p2_breakreminder = {
    id: "p2_breakreminder",
    title: "widget.p2_breakreminder",
    category: "productivity",
    description: "Fires a desktop notification every N minutes to take a break",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        let alive = true;
        let interval = 30; // minutes
        let running = false;
        let nextAt = 0;
        let timer = null;   // fires the notification
        let uiTick = null;  // updates countdown label

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px">
                <div style="display:flex;align-items:center;gap:6px">
                    <label style="font-size:12px;color:var(--text-dim)">Every</label>
                    <input id="_br_min" type="number" min="1" max="600" step="1"
                        style="width:64px;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:5px 8px;font-size:12px;font-variant-numeric:tabular-nums">
                    <label style="font-size:12px;color:var(--text-dim)">min</label>
                    <button id="_br_go" style="margin-left:auto;background:var(--accent);border:none;color:#fff;border-radius:6px;padding:5px 14px;cursor:pointer;font-size:12px">Start</button>
                </div>
                <div id="_br_status" style="font-size:12px;color:var(--text-dim);font-variant-numeric:tabular-nums"></div>
                <div id="_br_hint" style="font-size:11px;color:var(--text-dim)"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        const minIn = $("#_br_min"), goBtn = $("#_br_go"), statusEl = $("#_br_status"), hintEl = $("#_br_hint");

        const save = () => window.dyo.settings.set({ "p2.breakreminder": { interval, running, nextAt } });

        const fmt = ms => {
            let s = Math.max(0, Math.floor(ms / 1000));
            const m = Math.floor(s / 60); s -= m * 60;
            return `${m}m ${String(s).padStart(2, "0")}s`;
        };

        const notify = () => {
            const title = "Take a break ☕";
            const bodyTxt = `You've been working for ${interval} min. Stretch, hydrate, rest your eyes.`;
            try {
                if (typeof Notification !== "undefined") {
                    if (Notification.permission === "granted") {
                        new Notification(title, { body: bodyTxt });
                    } else if (Notification.permission !== "denied") {
                        Notification.requestPermission().then(p => { if (p === "granted") new Notification(title, { body: bodyTxt }); });
                    }
                }
            } catch (e) { /* ignore */ }
        };

        const schedule = () => {
            clearTimeout(timer);
            const delay = Math.max(0, nextAt - Date.now());
            timer = setTimeout(function fire() {
                if (!alive || !running) return;
                notify();
                nextAt = Date.now() + interval * 60000;
                save();
                timer = setTimeout(fire, interval * 60000);
            }, delay);
        };

        const renderStatus = () => {
            if (running) {
                statusEl.textContent = `Next break in ${fmt(nextAt - Date.now())}`;
                statusEl.style.color = "var(--accent2)";
            } else {
                statusEl.textContent = "Stopped";
                statusEl.style.color = "var(--text-dim)";
            }
            goBtn.textContent = running ? "Stop" : "Start";
            goBtn.style.background = running ? "var(--danger)" : "var(--accent)";
            minIn.disabled = running;
        };

        const start = () => {
            const v = parseInt(minIn.value, 10);
            interval = (isFinite(v) && v >= 1 && v <= 600) ? v : 30;
            minIn.value = interval;
            running = true;
            nextAt = Date.now() + interval * 60000;
            if (typeof Notification !== "undefined" && Notification.permission === "default") {
                Notification.requestPermission().catch(() => {});
            }
            hintEl.textContent = (typeof Notification !== "undefined" && Notification.permission === "denied")
                ? "Notifications are blocked by the OS/app settings." : "";
            save(); schedule(); renderStatus();
        };
        const stop = () => { running = false; clearTimeout(timer); save(); renderStatus(); };

        goBtn.onclick = () => { running ? stop() : start(); };

        uiTick = setInterval(() => { if (alive && running) renderStatus(); }, 1000);

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            const stored = s && s["p2.breakreminder"];
            if (stored && typeof stored === "object") {
                const v = parseInt(stored.interval, 10);
                interval = (isFinite(v) && v >= 1 && v <= 600) ? v : 30;
                running = !!stored.running;
            }
            minIn.value = interval;
            if (running) {
                // resume: if the stored deadline already passed, fire soon
                nextAt = (typeof stored.nextAt === "number" && stored.nextAt > Date.now()) ? stored.nextAt : Date.now() + interval * 60000;
                schedule();
            }
            renderStatus();
        }).catch(() => { if (alive) { minIn.value = interval; renderStatus(); } });

        return { destroy: () => { alive = false; clearTimeout(timer); clearInterval(uiTick); } };
    }
};
