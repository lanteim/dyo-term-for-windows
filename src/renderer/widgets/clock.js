"use strict";
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.clock = {
    id: "clock",
    title: "widget.clock",
    category: "productivity",
    description: "Time & date",
    defaultSize: { w: 6, h: 2 },
    mount(body) {
        body.innerHTML = `<div style="display:flex;flex-direction:column;justify-content:center;height:100%">
            <div id="_clk_t" style="font-size:34px;font-weight:500;letter-spacing:2px;color:var(--text);font-variant-numeric:tabular-nums"></div>
            <div id="_clk_d" style="color:var(--text-dim);font-size:12px;letter-spacing:2px;margin-top:4px;text-transform:uppercase"></div>
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
