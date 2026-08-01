"use strict";
window.I18N.register({
    en: { "widget.prod-timer": "Countdown Timer", "cat.productivity": "Productivity" },
    ru: { "widget.prod-timer": "Таймер обратного отсчёта", "cat.productivity": "Продуктивность" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS["prod-timer"] = {
    id: "prod-timer",
    title: "widget.prod-timer",
    category: "productivity",
    description: "Countdown timer with a notification when it finishes",
    defaultSize: { w: 6, h: 2 },
    mount(body) {
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;justify-content:center;height:100%;gap:8px">
                <div id="_tm_disp" style="font-size:38px;font-weight:500;letter-spacing:2px;color:var(--text);font-variant-numeric:tabular-nums;text-align:center">00:00</div>
                <div style="display:flex;gap:6px;align-items:center;justify-content:center">
                    <input id="_tm_min" type="number" min="1" max="600" value="5"
                        style="width:56px;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:4px 6px;font-family:var(--font-mono);font-size:12px">
                    <span style="color:var(--text-dim);font-size:11px">min</span>
                    <button id="_tm_start" style="background:var(--accent);border:none;color:#fff;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:12px">Start</button>
                    <button id="_tm_pause" style="background:var(--bg-elevated);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:5px 12px;cursor:pointer;font-size:12px">Pause</button>
                    <button id="_tm_reset" style="background:var(--bg-elevated);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:5px 12px;cursor:pointer;font-size:12px">Reset</button>
                </div>
            </div>`;
        const $ = s => body.querySelector(s);
        const disp = $("#_tm_disp"), minInput = $("#_tm_min");
        let remaining = 0;      // seconds
        let running = false;
        let iv = null;
        let notifyTo = null;

        const fmt = sec => {
            sec = Math.max(0, Math.floor(sec));
            const m = Math.floor(sec / 60), s = sec % 60;
            return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
        };
        const render = () => { disp.textContent = fmt(remaining); };

        const notify = () => {
            disp.style.color = "var(--danger)";
            if (notifyTo) { clearTimeout(notifyTo); }
            notifyTo = setTimeout(() => { disp.style.color = "var(--text)"; notifyTo = null; }, 2500);
            try {
                if (window.Notification && Notification.permission === "granted") {
                    new Notification("Timer finished", { body: "Your countdown is up." });
                } else if (window.Notification && Notification.permission !== "denied") {
                    Notification.requestPermission().then(p => {
                        if (p === "granted") new Notification("Timer finished", { body: "Your countdown is up." });
                    });
                }
            } catch (e) { /* notifications unavailable */ }
        };

        const stop = () => { running = false; if (iv) { clearInterval(iv); iv = null; } };

        const start = () => {
            if (running) return;
            if (remaining <= 0) {
                const m = parseInt(minInput.value, 10);
                remaining = (isNaN(m) || m <= 0) ? 0 : Math.min(m, 600) * 60;
            }
            if (remaining <= 0) return;
            running = true;
            iv = setInterval(() => {
                remaining -= 1;
                if (remaining <= 0) { remaining = 0; render(); stop(); notify(); return; }
                render();
            }, 1000);
        };

        const reset = () => {
            stop();
            remaining = 0;
            disp.style.color = "var(--text)";
            render();
        };

        $("#_tm_start").onclick = start;
        $("#_tm_pause").onclick = stop;
        $("#_tm_reset").onclick = reset;

        if (window.Notification && Notification.permission === "default") {
            try { Notification.requestPermission(); } catch (e) { /* ignore */ }
        }
        render();
        return { destroy: () => { stop(); if (notifyTo) { clearTimeout(notifyTo); notifyTo = null; } } };
    }
};
