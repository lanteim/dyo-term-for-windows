"use strict";
window.I18N.register({
    en: { "widget.tool_uuid": "UUID Generator", "cat.tools": "Tools" },
    ru: { "widget.tool_uuid": "Генератор UUID", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.tool_uuid = {
    id: "tool_uuid",
    title: "widget.tool_uuid",
    category: "tools",
    description: "Generate v4 UUIDs, click to copy",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const btn = "background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:7px 12px;font-family:var(--font-mono);font-size:12px;cursor:pointer;font-weight:600";
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:8px;height:100%">
                <div style="display:flex;gap:6px;align-items:center">
                    <button class="uu-gen" style="${btn}">Generate</button>
                    <span class="uu-hint" style="font-size:11px;color:var(--text-dim)">click a row to copy</span>
                </div>
                <div class="uu-list" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:4px"></div>
            </div>`;
        const gen = body.querySelector(".uu-gen");
        const list = body.querySelector(".uu-list");
        const hist = [];
        const uuid = () => {
            if (crypto.randomUUID) return crypto.randomUUID();
            return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
                const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16;
                return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
            });
        };
        const render = () => {
            list.innerHTML = "";
            hist.forEach(u => {
                const row = document.createElement("div");
                row.textContent = u;
                row.title = "Click to copy";
                row.style.cssText = "font-family:var(--font-mono);font-size:12px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;cursor:pointer;background:var(--bg-elevated);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums";
                row.onclick = () => {
                    navigator.clipboard.writeText(u).catch(() => {});
                    const old = row.style.borderColor;
                    row.style.borderColor = "var(--accent)";
                    setTimeout(() => { row.style.borderColor = old; }, 400);
                };
                list.appendChild(row);
            });
        };
        const add = () => { hist.unshift(uuid()); if (hist.length > 10) hist.pop(); render(); };
        gen.onclick = add;
        add();
        return { destroy() { gen.onclick = null; } };
    }
};
