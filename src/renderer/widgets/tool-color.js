"use strict";
window.I18N.register({
    en: { "widget.tool_color": "Color Converter", "cat.tools": "Tools" },
    ru: { "widget.tool_color": "Конвертер Цвета", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.tool_color = {
    id: "tool_color",
    title: "widget.tool_color",
    category: "tools",
    description: "Convert hex/rgb/hsl with a live swatch",
    defaultSize: { w: 7, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono);font-size:13px";
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:8px;height:100%">
                <div style="display:flex;gap:8px;align-items:center">
                    <input class="cl-in" value="#3aa0ff" placeholder="#hex / rgb() / hsl()" style="${inp};flex:1" />
                    <div class="cl-sw" style="width:40px;height:32px;border-radius:6px;border:1px solid var(--border)"></div>
                </div>
                <div class="cl-err" style="font-size:11px;color:var(--danger);min-height:12px"></div>
                <div class="cl-out" style="flex:1;display:flex;flex-direction:column;gap:5px"></div>
            </div>`;
        const cin = body.querySelector(".cl-in");
        const sw = body.querySelector(".cl-sw");
        const err = body.querySelector(".cl-err");
        const cout = body.querySelector(".cl-out");

        const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
        const rgb2hsl = (r, g, b) => {
            r /= 255; g /= 255; b /= 255;
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
            let h = 0, s = 0, l = (mx + mn) / 2;
            if (mx !== mn) {
                const d = mx - mn;
                s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
                if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
                else if (mx === g) h = (b - r) / d + 2;
                else h = (r - g) / d + 4;
                h /= 6;
            }
            return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
        };
        const hsl2rgb = (h, s, l) => {
            h /= 360; s /= 100; l /= 100;
            const hue = (p, q, t) => {
                if (t < 0) t += 1; if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            let r, g, b;
            if (s === 0) { r = g = b = l; }
            else {
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                r = hue(p, q, h + 1 / 3); g = hue(p, q, h); b = hue(p, q, h - 1 / 3);
            }
            return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
        };
        const parse = str => {
            str = str.trim().toLowerCase();
            let m;
            if ((m = str.match(/^#?([0-9a-f]{3})$/))) {
                const h = m[1];
                return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
            }
            if ((m = str.match(/^#?([0-9a-f]{6})$/))) {
                return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
            }
            if ((m = str.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/))) {
                return [clamp(+m[1], 0, 255), clamp(+m[2], 0, 255), clamp(+m[3], 0, 255)];
            }
            if ((m = str.match(/^hsla?\(\s*(\d+)[,\s]+(\d+)%?[,\s]+(\d+)%?/))) {
                return hsl2rgb(clamp(+m[1], 0, 360), clamp(+m[2], 0, 100), clamp(+m[3], 0, 100));
            }
            return null;
        };
        const copyRow = (label, val) => {
            const row = document.createElement("div");
            row.className = "metric-row";
            row.style.cursor = "pointer";
            row.title = "Click to copy";
            row.innerHTML = `<span class="k">${esc(label)}</span><span class="v" style="font-variant-numeric:tabular-nums">${esc(val)}</span>`;
            row.onclick = () => navigator.clipboard.writeText(val).catch(() => {});
            return row;
        };
        const run = () => {
            const rgb = parse(cin.value);
            if (!rgb) { err.textContent = "Unrecognized color"; cout.innerHTML = ""; return; }
            err.textContent = "";
            const [r, g, b] = rgb;
            const hex = "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
            const [h, s, l] = rgb2hsl(r, g, b);
            sw.style.background = hex;
            cout.innerHTML = "";
            cout.appendChild(copyRow("HEX", hex));
            cout.appendChild(copyRow("RGB", `rgb(${r}, ${g}, ${b})`));
            cout.appendChild(copyRow("HSL", `hsl(${h}, ${s}%, ${l}%)`));
        };
        cin.oninput = run;
        run();
        return { destroy() { cin.oninput = null; } };
    }
};
