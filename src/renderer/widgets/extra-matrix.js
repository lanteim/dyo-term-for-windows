"use strict";
window.I18N.register({
    en: { "widget.extra_matrix": "Matrix Rain", "cat.ambient": "Ambient" },
    ru: { "widget.extra_matrix": "Матрица", "cat.ambient": "Эмбиент" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.extra_matrix = {
    id: "extra_matrix",
    title: "widget.extra_matrix",
    category: "ambient",
    description: "Subtle matrix rain animation on a canvas",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        let alive = true, raf = 0, running = true, ro = null;
        body.innerHTML = `
            <div style="position:relative;height:100%;width:100%;overflow:hidden">
              <canvas class="_cv" style="display:block;width:100%;height:100%"></canvas>
              <button class="_tg" style="position:absolute;top:6px;right:6px;z-index:2;background:rgba(0,0,0,.35);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-family:var(--font-mono);font-size:11px">Pause</button>
            </div>`;
        const cv = body.querySelector("._cv");
        const btn = body.querySelector("._tg");
        const ctx = cv.getContext("2d");
        const GLYPHS = "アイウエオカキクケコサシスセソﾀﾁﾂﾃﾄ0123456789ABCDEF<>=/*+-".split("");
        const font = 14;
        let cols = 0, drops = [], W = 0, H = 0;

        const resize = () => {
            const dpr = window.devicePixelRatio || 1;
            W = cv.clientWidth || 300; H = cv.clientHeight || 200;
            cv.width = Math.max(1, Math.floor(W * dpr));
            cv.height = Math.max(1, Math.floor(H * dpr));
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            cols = Math.max(1, Math.floor(W / font));
            drops = new Array(cols).fill(0).map(() => Math.floor(Math.random() * -40));
            ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
        };

        const accent = () => {
            const c = getComputedStyle(document.documentElement).getPropertyValue("--accent2") || getComputedStyle(document.documentElement).getPropertyValue("--accent");
            return (c && c.trim()) || "#39ff14";
        };
        let color = accent();

        const draw = () => {
            if (!alive) return;
            ctx.fillStyle = "rgba(0,0,0,0.08)";
            ctx.fillRect(0, 0, W, H);
            ctx.font = font + "px var(--font-mono, monospace)";
            for (let i = 0; i < cols; i++) {
                const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
                const x = i * font, y = drops[i] * font;
                ctx.fillStyle = color;
                ctx.fillText(ch, x, y);
                if (y > H && Math.random() > 0.975) drops[i] = 0;
                drops[i]++;
            }
            if (running) raf = requestAnimationFrame(draw);
        };

        resize();
        draw();
        try { ro = new ResizeObserver(() => { if (alive) resize(); }); ro.observe(cv); } catch (e) {}

        btn.onclick = () => {
            running = !running;
            btn.textContent = running ? "Pause" : "Play";
            color = accent();
            if (running) { cancelAnimationFrame(raf); draw(); } else cancelAnimationFrame(raf);
        };

        return { destroy: () => { alive = false; running = false; cancelAnimationFrame(raf); if (ro) ro.disconnect(); } };
    }
};
