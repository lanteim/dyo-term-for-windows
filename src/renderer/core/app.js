"use strict";
// Bootstrap: wires the top bar, terminal manager, dashboard, theme gallery
// and global keybindings (iTerm-flavoured).

(async function main() {
    const info = await window.dyo.appInfo();
    window.__DYO_NOWEBGL = info.noWebgl;
    window.__PLATFORM = info.platform;
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
    const dashBtn = mkBtn("grid", "btn.dash", () => toggleDash(), "dash-btn");
    mkBtn("expand", "btn.fullscreen", () => window.dyo.win("toggleFullscreen"));

    // Collapse/expand the widget dashboard (terminals fill the whole width)
    function toggleDash() {
        const collapsed = document.body.classList.toggle("dash-collapsed");
        dashBtn.classList.toggle("active", collapsed);
        window.dyo.settings.set({ dashCollapsed: collapsed });
        requestAnimationFrame(() => { const t = term.activeTab(); if (t) t._fitAll(t.root); });
    }
    if (settings.dashCollapsed) toggleDash();

    // Draggable divider: resize the terminal area vs the dashboard
    (function () {
        const divider = document.getElementById("main-divider");
        const main = document.getElementById("main");
        const tcol = document.getElementById("terminal-col");
        const dcol = document.getElementById("dash-col");
        divider.addEventListener("mousedown", e => {
            e.preventDefault();
            const rect = main.getBoundingClientRect();
            const onMove = ev => {
                let ratio = (ev.clientX - rect.left) / rect.width;
                ratio = Math.min(0.88, Math.max(0.2, ratio));
                tcol.style.flex = ratio + " 1 0";
                dcol.style.flex = (1 - ratio) + " 1 0";
            };
            const onUp = () => {
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
                const t = term.activeTab(); if (t) t._fitAll(t.root);
            };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
        });
    })();

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

    // ---- keybindings ----
    // macOS: ⌘-based (iTerm-flavoured). Windows/Linux: Ctrl+Shift-based, so the
    // app shortcuts never clash with shell control keys (Ctrl+C/D/W/F/E/K).
    const isMac = window.__PLATFORM === "darwin";
    window.addEventListener("keydown", e => {
        if (!isMac && e.key === "F11") { e.preventDefault(); window.dyo.win("toggleFullscreen"); return; }
        const primary = isMac ? e.metaKey : (e.ctrlKey && e.shiftKey);
        if (!primary) return;
        const k = (e.key || "").toLowerCase();
        const digit = /^Digit([1-9])$/.exec(e.code || "");
        if (k === "t") { e.preventDefault(); term.newTab(); }
        else if (k === "w") { e.preventDefault(); term.closeFocusedPane(); }
        else if (k === "f") { e.preventDefault(); toggleSearch(); }
        else if (k === "e") { e.preventDefault(); toggleEdit(); }
        else if (k === "k") { e.preventDefault(); openThemes(); }
        else if (digit) { e.preventDefault(); term.focusTab(parseInt(digit[1], 10) - 1); }
        else if (isMac && k === "enter") { e.preventDefault(); window.dyo.win("toggleFullscreen"); }
        else if (k === "d") { e.preventDefault(); term.splitFocused(isMac && e.shiftKey ? "horizontal" : "vertical"); }
        else if (!isMac && k === "h") { e.preventDefault(); term.splitFocused("horizontal"); }
    });

    // Copy/paste in form fields (the OS menu deliberately doesn't grab these keys
    // so the terminal can copy its own selection — see core/terminal.js). Handled
    // here for inputs/textareas; skips the terminal panes, which handle their own.
    document.addEventListener("keydown", async e => {
        const k = (e.key || "").toLowerCase();
        const copy = isMac ? (e.metaKey && !e.shiftKey && k === "c") : (e.ctrlKey && e.shiftKey && k === "c");
        const paste = isMac ? (e.metaKey && !e.shiftKey && k === "v") : (e.ctrlKey && e.shiftKey && k === "v");
        if (!copy && !paste) return;
        const ae = document.activeElement;
        if (!ae || (ae.closest && ae.closest(".pane"))) return; // terminal handles itself
        const isField = ae.tagName === "INPUT" || ae.tagName === "TEXTAREA";
        if (!isField && !ae.isContentEditable) return;
        if (copy) {
            let text = isField ? ae.value.substring(ae.selectionStart, ae.selectionEnd) : String(window.getSelection());
            if (text) { e.preventDefault(); navigator.clipboard.writeText(text).catch(() => {}); }
        } else if (paste && isField) {
            e.preventDefault();
            const t = await navigator.clipboard.readText().catch(() => "");
            if (t) {
                const s = ae.selectionStart, en = ae.selectionEnd;
                ae.value = ae.value.slice(0, s) + t + ae.value.slice(en);
                ae.selectionStart = ae.selectionEnd = s + t.length;
                ae.dispatchEvent(new Event("input", { bubbles: true }));
            }
        }
    }, true);
})();

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}
