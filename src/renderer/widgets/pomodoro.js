"use strict";
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.pomodoro = {
    id: "pomodoro",
    title: "widget.pomodoro",
    category: "productivity",
    description: "Focus timer (25/5)",
    defaultSize: { w: 6, h: 2 },
    mount(body) {
        body.innerHTML = `<div style="display:flex;flex-direction:column;height:100%;justify-content:center">
            <div id="_pom_t" style="font-size:32px;font-weight:500;font-variant-numeric:tabular-nums;color:var(--text)">25:00</div>
            <div id="_pom_phase" style="color:var(--text-dim);font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-top:2px">FOCUS</div>
            <div style="display:flex;gap:8px;margin-top:10px">
                <button id="_pom_go">Start</button>
                <button id="_pom_rst">Reset</button>
            </div>
        </div>`;
        body.querySelectorAll("button").forEach(b => b.style.cssText = "border:1px solid var(--border);background:transparent;color:var(--text);border-radius:8px;padding:6px 12px;cursor:pointer;font-family:var(--font-ui)");
        const WORK = 25 * 60, BREAK = 5 * 60;
        let remaining = WORK, phase = "FOCUS", running = false, iv = null;
        const $ = s => body.querySelector(s);
        const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
        const draw = () => { $("#_pom_t").textContent = fmt(remaining); $("#_pom_phase").textContent = phase; };
        const tick = () => {
            remaining--;
            if (remaining <= 0) {
                phase = phase === "FOCUS" ? "BREAK" : "FOCUS";
                remaining = phase === "FOCUS" ? WORK : BREAK;
                try { new Notification("dyo-term", { body: phase === "BREAK" ? "Break time" : "Back to focus" }); } catch (e) {}
            }
            draw();
        };
        $("#_pom_go").onclick = () => {
            running = !running;
            $("#_pom_go").textContent = running ? "Pause" : "Start";
            if (running) iv = setInterval(tick, 1000); else clearInterval(iv);
        };
        $("#_pom_rst").onclick = () => { clearInterval(iv); running = false; phase = "FOCUS"; remaining = WORK; $("#_pom_go").textContent = "Start"; draw(); };
        draw();
        return { destroy: () => clearInterval(iv) };
    }
};
