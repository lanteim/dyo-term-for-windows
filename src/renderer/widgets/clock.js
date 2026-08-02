"use strict";
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.clock = {
    id: "clock",
    title: "widget.clock",
    category: "productivity",
    description: "Time & date",
    defaultSize: { w: 6, h: 2 },
    mount(body) {
        // The time scales to the widget's own box (container query units) so it fills
        // the width nicely on big widgets yet stays legible when small — width (cqw)
        // and height (cqh) are both capped so it never overflows a short/wide tile.
        body.innerHTML = `<div style="container-type:size;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:2px">
            <div id="_clk_t" style="font-size:clamp(1.7rem, min(15cqw, 42cqh), 6rem);font-weight:500;letter-spacing:2px;line-height:1;color:var(--text);font-variant-numeric:tabular-nums"></div>
            <div id="_clk_d" style="color:var(--text-dim);font-size:clamp(0.62rem, min(4cqw, 11cqh), 1.05rem);letter-spacing:2px;text-transform:uppercase"></div>
        </div>`;
        const t = body.querySelector("#_clk_t");
        const d = body.querySelector("#_clk_d");
        const tick = () => {
            const now = new Date();
            t.textContent = now.toLocaleTimeString([], { hour12: false });
            d.textContent = now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short", year: "numeric" });
        };
        tick();
        const iv = setInterval(tick, 1000);
        return { destroy: () => clearInterval(iv) };
    }
};
