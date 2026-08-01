"use strict";
window.WIDGETS = window.WIDGETS || {};

function escC(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}

window.WIDGETS.clipboard = {
    id: "clipboard",
    title: "widget.clipboard",
    category: "productivity",
    description: "Clipboard history (click to re-copy)",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        body.innerHTML = `<div class="clip-list" style="display:flex;flex-direction:column;gap:4px;height:100%;overflow:auto"></div>`;
        const list = body.querySelector(".clip-list");
        const hist = [];
        let alive = true;

        const render = () => {
            list.innerHTML = "";
            if (!hist.length) { list.innerHTML = `<div style="color:var(--text-dim);font-size:12px">Copy something to see it here…</div>`; return; }
            hist.forEach(text => {
                const row = document.createElement("div");
                row.textContent = text.length > 120 ? text.slice(0, 120) + "…" : text;
                row.title = "Click to copy";
                row.style.cssText = "font-family:var(--font-mono);font-size:11.5px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:var(--bg-elevated)";
                row.onclick = () => navigator.clipboard.writeText(text).catch(() => {});
                list.appendChild(row);
            });
        };

        const tick = async () => {
            if (!alive) return;
            try {
                const text = await navigator.clipboard.readText();
                if (text && hist[0] !== text) {
                    const i = hist.indexOf(text);
                    if (i > -1) hist.splice(i, 1);
                    hist.unshift(text);
                    if (hist.length > 25) hist.pop();
                    render();
                }
            } catch (e) { /* not focused / no permission */ }
        };
        render();
        const iv = setInterval(tick, 1500);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
