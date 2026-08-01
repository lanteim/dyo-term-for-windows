"use strict";
// Bootstrap: wires the top bar, terminal manager, dashboard, theme gallery
// and global keybindings (iTerm-flavoured).

(async function main() {
    const info = await window.dyo.appInfo();
    window.__DYO_NOWEBGL = info.noWebgl;
    const settings = await window.dyo.settings.get();
    await window.ThemeEngine.load();
    window.ThemeEngine.apply(settings.theme in window.ThemeEngine.themes ? settings.theme : "stark");

    // Language (default English)
    window.I18N.lang = settings.lang && window.I18N.dict[settings.lang] ? settings.lang : "en";

    const meta = document.getElementById("meta");
    const renderMeta = () => {
        meta.textContent = `${info.arch} · electron ${info.electron.split(".")[0]} · ${info.cpus} ${window.I18N.t("meta.cores")}`;
    };
    renderMeta();

    const term = new window.TerminalManager(settings);
    window.term = term;
    const dash = new window.Dashboard(document.getElementById("dash-col"), settings);
    window.dash = dash;

    window.ThemeEngine.onChange(() => term.reloadThemeOnAll());

    // ---- top bar actions ----
    const actions = document.getElementById("actions");
    const mkBtn = (icon, titleKey, onclick, id) => {
        const b = document.createElement("button");
        b.className = "iconbtn";
        b.innerHTML = window.ICONS[icon];
        b.setAttribute("data-i18n-title", titleKey);
        b.title = window.I18N.t(titleKey);
        b.onclick = onclick;
        if (id) b.id = id;
        actions.appendChild(b);
        return b;
    };
    mkBtn("splitV", "btn.splitV", () => term.splitFocused("vertical"));
    mkBtn("splitH", "btn.splitH", () => term.splitFocused("horizontal"));
    mkBtn("search", "btn.search", () => toggleSearch());
    const editBtn = mkBtn("edit", "btn.edit", () => toggleEdit(), "edit-btn");
    mkBtn("palette", "btn.themes", () => openThemes());
    mkBtn("lang", "btn.lang", (e) => openLangMenu(e.currentTarget));
    mkBtn("expand", "btn.fullscreen", () => window.dyo.win("toggleFullscreen"));

    // Language menu (default English)
    let langMenu = null;
    function openLangMenu(anchor) {
        if (langMenu) { langMenu.remove(); langMenu = null; return; }
        langMenu = document.createElement("div");
        langMenu.style.cssText = "position:absolute;top:44px;right:52px;z-index:30;min-width:150px;padding:6px;border:1px solid var(--border-strong);border-radius:10px;background:var(--bg-elevated);display:flex;flex-direction:column;gap:2px";
        window.I18N.languages.forEach(l => {
            const item = document.createElement("div");
            item.textContent = l.label;
            item.style.cssText = "padding:8px 10px;border-radius:7px;cursor:pointer;font-size:12px;color:" + (l.code === window.I18N.lang ? "var(--accent)" : "var(--text)");
            item.onmouseenter = () => item.style.background = "var(--bg-panel)";
            item.onmouseleave = () => item.style.background = "transparent";
            item.onclick = () => { setLang(l.code); langMenu.remove(); langMenu = null; };
            langMenu.appendChild(item);
        });
        document.getElementById("app").appendChild(langMenu);
        setTimeout(() => document.addEventListener("mousedown", closeLangOnce, { once: true }), 0);
    }
    function closeLangOnce(e) {
        if (langMenu && !langMenu.contains(e.target)) { langMenu.remove(); langMenu = null; }
    }
    function setLang(code) {
        window.I18N.set(code);
        window.dyo.settings.set({ lang: code });
        renderMeta();
        term.renderTabs();
    }

    window.I18N.apply();
    window.I18N.onChange(() => { renderMeta(); });

    let editing = false;
    function toggleEdit() {
        editing = !editing;
        dash.setEditing(editing);
        editBtn.classList.toggle("active", editing);
    }

    // ---- theme gallery ----
    function openThemes() {
        const grid = document.getElementById("theme-grid");
        grid.innerHTML = "";
        Object.entries(window.ThemeEngine.themes).forEach(([key, t]) => {
            const card = document.createElement("div");
            card.className = "theme-card" + (key === window.ThemeEngine.current ? " active" : "");
            const c = t.colors;
            card.innerHTML = `
                <div class="swatch">
                    <i style="background:${c.bg}"></i>
                    <i style="background:${c.accent}"></i>
                    <i style="background:${c.accent2}"></i>
                    <i style="background:${c.bgElevated}"></i>
                </div>
                <div class="name">${escapeHtml(t.name || key)}<small>${escapeHtml(t.description || "")}</small></div>`;
            card.onclick = () => {
                window.ThemeEngine.apply(key);
                window.dyo.settings.set({ theme: key });
                document.getElementById("theme-overlay").classList.remove("open");
            };
            grid.appendChild(card);
        });
        document.getElementById("theme-overlay").classList.add("open");
    }
    document.getElementById("theme-overlay").addEventListener("click", e => {
        if (e.target.id === "theme-overlay") e.currentTarget.classList.remove("open");
    });

    // ---- search bar ----
    let searchBar = null;
    function toggleSearch() {
        if (searchBar) { searchBar.remove(); searchBar = null; return; }
        searchBar = document.createElement("div");
        searchBar.style.cssText = "position:absolute;top:44px;right:14px;z-index:20;display:flex;gap:6px;padding:6px;border:1px solid var(--border-strong);border-radius:8px;background:var(--bg-elevated)";
        searchBar.innerHTML = `<input id="_find" placeholder="${window.I18N.t("find.placeholder")}" style="background:transparent;border:none;outline:none;color:var(--text);font-family:var(--font-mono);width:200px"/>`;
        document.getElementById("terminal-col").appendChild(searchBar);
        const input = searchBar.querySelector("#_find");
        input.focus();
        input.addEventListener("keydown", e => {
            if (e.key === "Enter") term.search(input.value);
            if (e.key === "Escape") toggleSearch();
        });
    }

    // ---- keybindings (⌘-based, iTerm-flavoured) ----
    window.addEventListener("keydown", e => {
        const cmd = e.metaKey;
        if (!cmd) return;
        if (e.key === "t") { e.preventDefault(); term.newTab(); }
        else if (e.key === "d" && !e.shiftKey) { e.preventDefault(); term.splitFocused("vertical"); }
        else if ((e.key === "d" || e.key === "D") && e.shiftKey) { e.preventDefault(); term.splitFocused("horizontal"); }
        else if (e.key === "w") { e.preventDefault(); term.closeFocusedPane(); }
        else if (e.key === "f") { e.preventDefault(); toggleSearch(); }
        else if (e.key === "e") { e.preventDefault(); toggleEdit(); }
        else if (e.key === "k") { e.preventDefault(); openThemes(); }
        else if (e.key === "Enter") { e.preventDefault(); window.dyo.win("toggleFullscreen"); }
        else if (/^[1-9]$/.test(e.key)) { e.preventDefault(); term.focusTab(parseInt(e.key, 10) - 1); }
    });
})();

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}
