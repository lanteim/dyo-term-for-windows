"use strict";
window.I18N.register({
    en: { "widget.p2_scratch2": "Scratchpad II", "cat.productivity": "Productivity" },
    ru: { "widget.p2_scratch2": "Блокнот II", "cat.productivity": "Продуктивность" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.p2_scratch2 = {
    id: "p2_scratch2",
    title: "widget.p2_scratch2",
    category: "productivity",
    description: "A second independent scratchpad, autosaved to settings",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        let alive = true;
        let saveTimer = null;
        let statusTimer = null;

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:4px">
                <textarea id="_s2_ta" spellcheck="false" placeholder="Second scratchpad — autosaved, separate from Notes…"
                    style="flex:1;resize:none;width:100%;box-sizing:border-box;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px;font-size:12px;font-family:var(--font-mono);line-height:1.4"></textarea>
                <div style="display:flex;align-items:center;gap:8px">
                    <span id="_s2_stat" style="font-size:10px;color:var(--text-dim)"></span>
                    <span id="_s2_count" style="margin-left:auto;font-size:10px;color:var(--text-dim);font-variant-numeric:tabular-nums"></span>
                </div>
            </div>`;
        const $ = s => body.querySelector(s);
        const ta = $("#_s2_ta"), statEl = $("#_s2_stat"), countEl = $("#_s2_count");

        const updateCount = () => {
            const v = ta.value;
            const words = v.trim() ? v.trim().split(/\s+/).length : 0;
            countEl.textContent = `${v.length} chars · ${words} words`;
        };
        const flash = (msg) => {
            statEl.textContent = msg;
            clearTimeout(statusTimer);
            statusTimer = setTimeout(() => { if (alive) statEl.textContent = ""; }, 1500);
        };
        const doSave = () => { window.dyo.settings.set({ "p2.scratch2": ta.value }); flash("saved"); };

        ta.addEventListener("input", () => {
            updateCount();
            clearTimeout(saveTimer);
            saveTimer = setTimeout(doSave, 400);
        });

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            const v = s && s["p2.scratch2"];
            ta.value = typeof v === "string" ? v : "";
            updateCount();
        }).catch(() => { if (alive) updateCount(); });

        return { destroy: () => {
            alive = false;
            clearTimeout(saveTimer);
            clearTimeout(statusTimer);
            window.dyo.settings.set({ "p2.scratch2": ta.value });
        } };
    }
};
