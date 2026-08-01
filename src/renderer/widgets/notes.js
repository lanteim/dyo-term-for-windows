"use strict";
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.notes = {
    id: "notes",
    title: "widget.notes",
    category: "productivity",
    description: "Autosaved scratchpad",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        body.innerHTML = `<textarea class="notes" spellcheck="false" data-i18n-ph="notes.placeholder" placeholder="${window.I18N.t("notes.placeholder")}"></textarea>`;
        const ta = body.querySelector("textarea");
        let saveTimer = null;
        window.dyo.notes.get().then(v => { ta.value = v || ""; });
        ta.addEventListener("input", () => {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(() => window.dyo.notes.set(ta.value), 400);
        });
        return { destroy: () => { clearTimeout(saveTimer); window.dyo.notes.set(ta.value); } };
    }
};
