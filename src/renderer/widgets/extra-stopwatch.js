"use strict";
window.I18N.register({
    en: { "widget.extra_stopwatch": "Stopwatch", "cat.productivity": "Productivity" },
    ru: { "widget.extra_stopwatch": "Секундомер", "cat.productivity": "Продуктивность" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.extra_stopwatch = {
    id: "extra_stopwatch",
    title: "widget.extra_stopwatch",
    category: "productivity",
    description: "Stopwatch with lap times, ms precision",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        let alive = true, raf = 0, running = false, base = 0, acc = 0;
        const laps = [];

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px">
              <div class="_disp" style="font-size:34px;font-weight:500;letter-spacing:1px;color:var(--text);font-variant-numeric:tabular-nums;text-align:center;padding:6px 0">00:00.000</div>
              <div style="display:flex;gap:6px;justify-content:center">
                <button class="_go" style="min-width:70px">Start</button>
                <button class="_lap">Lap</button>
                <button class="_rst">Reset</button>
              </div>
              <div class="_laps" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:4px;font-size:12px;font-variant-numeric:tabular-nums"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        ["._go", "._lap", "._rst"].forEach(s => { $(s).style.cssText += ";background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;cursor:pointer;font-family:var(--font-mono)"; });
        $("._go").style.borderColor = "var(--accent)";

        const fmt = ms => {
            const m = Math.floor(ms / 60000);
            const s = Math.floor((ms % 60000) / 1000);
            const mmm = Math.floor(ms % 1000);
            return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0") + "." + String(mmm).padStart(3, "0");
        };
        const elapsed = () => acc + (running ? (performance.now() - base) : 0);
        const tick = () => {
            if (!alive) return;
            $("._disp").textContent = fmt(elapsed());
            if (running) raf = requestAnimationFrame(tick);
        };
        const renderLaps = () => {
            $("._laps").innerHTML = laps.length ? laps.map((l, i) =>
                `<div style="display:flex;justify-content:space-between;padding:3px 6px;border-bottom:1px solid var(--border)"><span style="color:var(--text-dim)">Lap ${i + 1}</span><span>${fmt(l.split)}</span><span style="color:var(--accent2)">${fmt(l.total)}</span></div>`
            ).reverse().join("") : `<div style="color:var(--text-dim);padding:6px">No laps yet</div>`;
        };
        renderLaps();

        $("._go").onclick = () => {
            if (running) { acc = elapsed(); running = false; $("._go").textContent = "Start"; $("._go").style.borderColor = "var(--accent)"; }
            else { base = performance.now(); running = true; $("._go").textContent = "Stop"; $("._go").style.borderColor = "var(--danger)"; tick(); }
        };
        $("._lap").onclick = () => {
            if (!running && !acc) return;
            const total = elapsed();
            const prev = laps.length ? laps[laps.length - 1].total : 0;
            laps.push({ total, split: total - prev });
            renderLaps();
        };
        $("._rst").onclick = () => {
            running = false; acc = 0; base = 0; laps.length = 0;
            cancelAnimationFrame(raf);
            $("._go").textContent = "Start"; $("._go").style.borderColor = "var(--accent)";
            $("._disp").textContent = "00:00.000";
            renderLaps();
        };

        return { destroy: () => { alive = false; cancelAnimationFrame(raf); } };
    }
};
