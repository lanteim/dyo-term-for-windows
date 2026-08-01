"use strict";
window.I18N.register({
    en: { "widget.ref2_shortcuts": "Keyboard Shortcuts", "cat.reference": "Reference" },
    ru: { "widget.ref2_shortcuts": "Горячие клавиши", "cat.reference": "Справочник" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.ref2_shortcuts = {
    id: "ref2_shortcuts",
    title: "widget.ref2_shortcuts",
    category: "reference",
    description: "dyo-term keyboard shortcuts reference",
    defaultSize: { w: 7, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const S = [
            ["Tabs", [
                ["⌘T", "New tab"],
                ["⌘1 – ⌘9", "Jump to tab 1–9"],
                ["⌘W", "Close pane"]
            ]],
            ["Splits", [
                ["⌘D", "Split vertically"],
                ["⌘⇧D", "Split horizontally"]
            ]],
            ["Tools", [
                ["⌘F", "Find in terminal"],
                ["⌘E", "Edit widgets"],
                ["⌘K", "Themes"]
            ]]
        ];
        body.innerHTML = `
            <div style="overflow:auto;height:100%;display:flex;flex-direction:column;gap:10px">
              ${S.map(([title, rows]) => `
                <div>
                  <div style="color:var(--text-dim);font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">${esc(title)}</div>
                  <div style="display:flex;flex-direction:column;gap:4px">
                    ${rows.map(([k, d]) =>
            `<div style="display:flex;align-items:center;gap:10px">
                        <kbd style="font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;padding:3px 8px;color:var(--accent);min-width:70px;text-align:center">${esc(k)}</kbd>
                        <span style="font-size:12px;color:var(--text)">${esc(d)}</span>
                      </div>`).join("")}
                  </div>
                </div>`).join("")}
            </div>`;
        return { destroy() {} };
    }
};
