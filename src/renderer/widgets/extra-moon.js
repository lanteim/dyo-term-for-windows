"use strict";
window.I18N.register({
    en: { "widget.extra_moon": "Moon Phase", "cat.ambient": "Ambient" },
    ru: { "widget.extra_moon": "Фаза Луны", "cat.ambient": "Эмбиент" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.extra_moon = {
    id: "extra_moon",
    title: "widget.extra_moon",
    category: "ambient",
    description: "Current moon phase from date (no network)",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        let alive = true;
        const SYN = 29.53058867; // synodic month (days)
        // Known new moon reference: 2000-01-06 18:14 UTC
        const REF = Date.UTC(2000, 0, 6, 18, 14, 0);
        const PHASES = [
            { n: "New Moon", e: "🌑" }, { n: "Waxing Crescent", e: "🌒" }, { n: "First Quarter", e: "🌓" },
            { n: "Waxing Gibbous", e: "🌔" }, { n: "Full Moon", e: "🌕" }, { n: "Waning Gibbous", e: "🌖" },
            { n: "Last Quarter", e: "🌗" }, { n: "Waning Crescent", e: "🌘" }
        ];

        body.innerHTML = `
            <div style="display:flex;align-items:center;gap:14px;height:100%">
              <div class="_e" style="font-size:56px;line-height:1"></div>
              <div style="display:flex;flex-direction:column;gap:4px">
                <div class="_n" style="font-size:16px;font-weight:600;color:var(--text)"></div>
                <div class="_i" style="color:var(--accent2);font-size:13px;font-variant-numeric:tabular-nums"></div>
                <div class="_age" style="color:var(--text-dim);font-size:12px;font-variant-numeric:tabular-nums"></div>
              </div>
            </div>`;
        const $ = s => body.querySelector(s);

        const compute = () => {
            const now = Date.now();
            let age = ((now - REF) / 86400000) % SYN;
            if (age < 0) age += SYN;
            const frac = age / SYN; // 0..1
            const idx = Math.floor((frac * 8 + 0.5)) % 8;
            // illumination fraction (0 at new, 1 at full)
            const illum = (1 - Math.cos(2 * Math.PI * frac)) / 2;
            const p = PHASES[idx];
            $("._e").textContent = p.e;
            $("._n").textContent = p.n;
            $("._i").textContent = Math.round(illum * 100) + "% illuminated";
            $("._age").textContent = "Age: " + age.toFixed(1) + " days · cycle " + Math.round(frac * 100) + "%";
        };
        compute();
        const iv = setInterval(() => { if (alive) compute(); }, 60000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
