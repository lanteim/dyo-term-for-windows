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
    mkBtn("command", "btn.palette", () => openPalette());
    mkBtn("keyboard", "btn.cheatsheet", () => openCheatSheet());
    const editBtn = mkBtn("edit", "btn.edit", () => toggleEdit(), "edit-btn");
    mkBtn("palette", "btn.themes", () => openThemes());
    mkBtn("lang", "btn.lang", (e) => openLangMenu(e.currentTarget), "lang-btn");
    const dashBtn = mkBtn("grid", "btn.dash", () => toggleDash(), "dash-btn");
    mkBtn("density", "btn.density", (e) => openDensityMenu(e.currentTarget), "density-btn");
    const dockBtn = mkBtn("dock", "btn.dock", () => cycleDock(), "dock-btn");
    mkBtn("layers", "btn.layouts", (e) => openLayoutMenu(e.currentTarget), "layouts-btn");
    mkBtn("expand", "btn.fullscreen", () => window.dyo.win("toggleFullscreen"));

    // Dock the dashboard to any edge: right → bottom → left → top.
    const DOCKS = ["right", "bottom", "left", "top"];
    let dashDock = DOCKS.includes(settings.dashDock) ? settings.dashDock : "right";
    function applyDock(pos, save) {
        dashDock = DOCKS.includes(pos) ? pos : "right";
        document.body.classList.remove("dock-right", "dock-bottom", "dock-left", "dock-top");
        document.body.classList.add("dock-" + dashDock);
        // a prior divider drag left an inline flex sized for the old axis — reset it
        document.getElementById("terminal-col").style.flex = "";
        document.getElementById("dash-col").style.flex = "";
        if (save) window.dyo.settings.set({ dashDock });
        requestAnimationFrame(() => { const t = term.activeTab(); if (t) t._fitAll(t.root); });
    }
    function cycleDock() { applyDock(DOCKS[(DOCKS.indexOf(dashDock) + 1) % DOCKS.length], true); }
    applyDock(dashDock, false);
    window.__setDock = (pos) => applyDock(pos, true); // used when switching layouts
    window.__dashDock = () => dashDock;

    // ── A.Petrov metrics follow the active tab's ssh session ──
    // The focused pane is inspected for an ssh child; its connection is reused so
    // widgets read metrics from that server. Switching tab/pane re-detects.
    window.__monitorHost = null;
    let _hostKey = "__init";
    async function refreshMonitorHost() {
        let host = null;
        try {
            const tab = term.activeTab && term.activeTab();
            const pane = tab && tab.focused;
            if (pane && pane.id) host = await window.dyo.sshTarget(pane.id);
        } catch (e) { /* ignore transient detection errors */ }
        const key = host ? JSON.stringify(host) : "";
        if (key === _hostKey) return;
        _hostKey = key;
        window.__monitorHost = host ? { sshArgs: [...host.args, host.dest], label: host.label, dest: host.dest } : null;
        window.dispatchEvent(new CustomEvent("dyo-host-change", { detail: window.__monitorHost }));
    }
    window.refreshMonitorHost = refreshMonitorHost;
    setInterval(refreshMonitorHost, 2000);
    refreshMonitorHost();

    // ---- layout profiles menu ----
    let layoutMenu = null;
    function openLayoutMenu(anchor) {
        if (layoutMenu) { layoutMenu.remove(); layoutMenu = null; document.removeEventListener("mousedown", closeLayoutOnce); return; }
        const dash = window.dash;
        layoutMenu = document.createElement("div");
        layoutMenu.className = "popmenu";
        const render = () => {
            const names = dash.listLayouts();
            layoutMenu.innerHTML = `<div class="popmenu-h" data-i18n="btn.layouts">${window.I18N.t("btn.layouts")}</div>`;
            names.forEach(name => {
                const row = document.createElement("div");
                row.className = "popmenu-row" + (name === dash.activeLayout ? " active" : "");
                row.innerHTML = `<span class="nm">${escapeHtml(name)}</span>` + (names.length > 1 ? `<span class="del" title="Delete">${window.ICONS.close}</span>` : "");
                row.querySelector(".nm").onclick = () => { dash.switchLayout(name); render(); };
                const del = row.querySelector(".del");
                if (del) del.onclick = (ev) => { ev.stopPropagation(); dash.deleteLayout(name); render(); };
                layoutMenu.appendChild(row);
            });
            const add = document.createElement("div");
            add.className = "popmenu-add";
            add.innerHTML = `<input placeholder="New layout name…" spellcheck="false"><button>${window.ICONS.plus}</button>`;
            const inp = add.querySelector("input"), btn = add.querySelector("button");
            const create = () => { const n = dash.newLayout(inp.value); inp.value = ""; render(); };
            btn.onclick = create;
            inp.addEventListener("keydown", ev => { if (ev.key === "Enter") create(); ev.stopPropagation(); });
            layoutMenu.appendChild(add);
        };
        render();
        document.getElementById("app").appendChild(layoutMenu);
        const place = () => { const r = anchor.getBoundingClientRect(); layoutMenu.style.top = (r.bottom + 6) + "px"; layoutMenu.style.right = (window.innerWidth - r.right) + "px"; };
        place();
        setTimeout(() => document.addEventListener("mousedown", closeLayoutOnce), 0);
    }
    function closeLayoutOnce(e) {
        if (layoutMenu && !layoutMenu.contains(e.target) && !e.target.closest("#layouts-btn")) {
            layoutMenu.remove(); layoutMenu = null;
            document.removeEventListener("mousedown", closeLayoutOnce);
        }
    }

    // ---- density menu (Compact / Comfortable / Spacious) ----
    let densityMenu = null;
    function openDensityMenu(anchor) {
        if (densityMenu) { densityMenu.remove(); densityMenu = null; document.removeEventListener("mousedown", closeDensityOnce); return; }
        densityMenu = document.createElement("div");
        densityMenu.className = "popmenu";
        const render = () => {
            densityMenu.innerHTML = `<div class="popmenu-h" data-i18n="density.title">${window.I18N.t("density.title")}</div>`;
            ["compact", "comfortable", "spacious"].forEach(name => {
                const row = document.createElement("div");
                row.className = "popmenu-row" + (name === window.dash.density ? " active" : "");
                row.innerHTML = `<span class="nm">${window.I18N.t("density." + name)}</span>`;
                row.onclick = () => { window.dash.setDensity(name); render(); };
                densityMenu.appendChild(row);
            });
        };
        render();
        document.getElementById("app").appendChild(densityMenu);
        const r = anchor.getBoundingClientRect();
        densityMenu.style.top = (r.bottom + 6) + "px";
        densityMenu.style.right = (window.innerWidth - r.right) + "px";
        setTimeout(() => document.addEventListener("mousedown", closeDensityOnce), 0);
    }
    function closeDensityOnce(e) {
        if (densityMenu && !densityMenu.contains(e.target) && !e.target.closest("#density-btn")) {
            densityMenu.remove(); densityMenu = null;
            document.removeEventListener("mousedown", closeDensityOnce);
        }
    }

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
            const vertical = dashDock === "top" || dashDock === "bottom";
            const onMove = ev => {
                // fraction of the main axis given to the terminal
                let ratio = vertical ? (ev.clientY - rect.top) / rect.height : (ev.clientX - rect.left) / rect.width;
                if (dashDock === "left" || dashDock === "top") ratio = 1 - ratio; // dash sits before the terminal
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
        if (langMenu) { langMenu.remove(); langMenu = null; document.removeEventListener("mousedown", closeLangOnce); return; }
        langMenu = document.createElement("div");
        langMenu.style.cssText = "position:absolute;top:44px;right:52px;z-index:30;min-width:150px;padding:6px;border:1px solid var(--border-strong);border-radius:10px;background:var(--bg-elevated);display:flex;flex-direction:column;gap:2px";
        window.I18N.languages.forEach(l => {
            const item = document.createElement("div");
            item.textContent = l.label;
            item.style.cssText = "padding:8px 10px;border-radius:7px;cursor:pointer;font-size:12px;color:" + (l.code === window.I18N.lang ? "var(--accent)" : "var(--text)");
            item.onmouseenter = () => item.style.background = "var(--bg-panel)";
            item.onmouseleave = () => item.style.background = "transparent";
            item.onclick = () => { setLang(l.code); langMenu.remove(); langMenu = null; document.removeEventListener("mousedown", closeLangOnce); };
            langMenu.appendChild(item);
        });
        document.getElementById("app").appendChild(langMenu);
        setTimeout(() => document.addEventListener("mousedown", closeLangOnce), 0);
    }
    function closeLangOnce(e) {
        if (langMenu && !langMenu.contains(e.target) && !e.target.closest("#lang-btn")) {
            langMenu.remove(); langMenu = null;
            document.removeEventListener("mousedown", closeLangOnce);
        }
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

    // ---- search bar (Enter=next, Shift+Enter=prev, live count, highlight all) ----
    let searchBar = null;
    function toggleSearch() {
        if (searchBar) { closeSearch(); return; }
        const pane = term.activeTab() && term.activeTab().focused;
        searchBar = document.createElement("div");
        searchBar.className = "findbar";
        searchBar.innerHTML = `
            <input id="_find" placeholder="${escapeHtml(window.I18N.t("find.placeholder"))}" spellcheck="false"/>
            <span class="find-count" id="_findcount">0/0</span>
            <button class="find-btn" id="_findprev" title="${escapeHtml(window.I18N.t("find.prev"))}">${window.ICONS.caretUp}</button>
            <button class="find-btn" id="_findnext" title="${escapeHtml(window.I18N.t("find.next"))}">${window.ICONS.caretDown}</button>
            <button class="find-btn" id="_findclose" title="${escapeHtml(window.I18N.t("find.close"))}">${window.ICONS.close}</button>`;
        document.getElementById("terminal-col").appendChild(searchBar);
        const input = searchBar.querySelector("#_find");
        const count = searchBar.querySelector("#_findcount");
        searchBar._pane = pane;
        if (pane && pane.searchAddon && pane.searchAddon.onDidChangeResults) {
            searchBar._results = pane.searchAddon.onDidChangeResults(r => {
                const total = r.resultCount || 0;
                const idx = (r.resultIndex != null && r.resultIndex >= 0) ? (r.resultIndex + 1) : (total ? "–" : 0);
                count.textContent = `${idx}/${total}`;
                count.classList.toggle("nomatch", total === 0 && !!input.value);
            });
        }
        input.focus();
        input.addEventListener("keydown", e => {
            e.stopPropagation();
            if (e.key === "Enter") { e.preventDefault(); e.shiftKey ? term.searchPrev(input.value) : term.searchNext(input.value); }
            else if (e.key === "Escape") { e.preventDefault(); closeSearch(); }
        });
        input.addEventListener("input", () => { input.value ? term.searchNext(input.value, true) : term.searchClear(); });
        searchBar.querySelector("#_findnext").onclick = () => { term.searchNext(input.value); input.focus(); };
        searchBar.querySelector("#_findprev").onclick = () => { term.searchPrev(input.value); input.focus(); };
        searchBar.querySelector("#_findclose").onclick = () => closeSearch();
    }
    function closeSearch() {
        if (!searchBar) return;
        try { searchBar._results && searchBar._results.dispose(); } catch (e) {}
        try { searchBar._pane && searchBar._pane.searchAddon.clearDecorations(); } catch (e) {}
        searchBar.remove();
        searchBar = null;
        const p = term.activeTab() && term.activeTab().focused;
        if (p) p.focus();
    }

    // ---- command palette (fuzzy launcher, implemented in core/palette.js) ----
    function openPalette() { if (window.Palette) window.Palette.open(); }

    // ---- cycle dashboard layout profiles (palette / cheat-sheet action) ----
    function cycleLayout() {
        const names = window.dash.listLayouts();
        if (!names || names.length < 2) return;
        const i = names.indexOf(window.dash.activeLayout);
        window.dash.switchLayout(names[(i + 1) % names.length]);
    }

    // ---- searchable keybinding cheat-sheet, grouped by category ----
    let cheatOverlay = null;
    function openCheatSheet() {
        if (cheatOverlay) { closeCheatSheet(); return; }
        cheatOverlay = document.createElement("div");
        cheatOverlay.className = "overlay cheat-overlay open";
        cheatOverlay.innerHTML = `
            <div class="dialog cheat-dialog">
                <h2>${escapeHtml(window.I18N.t("cheatsheet.title"))}</h2>
                <input class="cheat-search" placeholder="${escapeHtml(window.I18N.t("cheatsheet.search"))}" spellcheck="false"/>
                <div class="cheat-body"></div>
            </div>`;
        document.body.appendChild(cheatOverlay);
        const search = cheatOverlay.querySelector(".cheat-search");
        const body = cheatOverlay.querySelector(".cheat-body");
        const cats = ["tabs", "panes", "terminal", "view", "dashboard", "app"];
        const caps = keys => keys ? keys.split(/\s+/).map(x => `<kbd>${escapeHtml(x)}</kbd>`).join("") : "—";
        const render = () => {
            const q = search.value.trim().toLowerCase();
            body.innerHTML = "";
            cats.forEach(cat => {
                const items = (window.__actions || []).filter(a => a.cat === cat).filter(a =>
                    !q || window.I18N.t(a.label).toLowerCase().includes(q) || (a.keys || "").toLowerCase().includes(q));
                if (!items.length) return;
                const group = document.createElement("div");
                group.className = "cheat-group";
                group.innerHTML = `<div class="cheat-cat">${escapeHtml(window.I18N.t("cat2." + cat))}</div>`;
                items.forEach(a => {
                    const row = document.createElement("div");
                    row.className = "cheat-row";
                    row.innerHTML = `<span class="cheat-label">${escapeHtml(window.I18N.t(a.label))}</span><span class="cheat-keys">${caps(a.keys)}</span>`;
                    group.appendChild(row);
                });
                body.appendChild(group);
            });
            if (!body.children.length) body.innerHTML = `<div class="cheat-empty">${escapeHtml(window.I18N.t("cheatsheet.none"))}</div>`;
        };
        render();
        search.focus();
        search.addEventListener("input", render);
        search.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); closeCheatSheet(); } });
        cheatOverlay.addEventListener("mousedown", e => { if (e.target === cheatOverlay) closeCheatSheet(); });
    }
    function closeCheatSheet() { if (cheatOverlay) { cheatOverlay.remove(); cheatOverlay = null; } }

    // ---- keybindings ----
    // macOS: ⌘-based (iTerm-flavoured). Windows/Linux: Ctrl+Shift-based, so the
    // app shortcuts never clash with shell control keys (Ctrl+C/D/W/F/E/K).
    // Pane nav/resize/broadcast additionally use ⌥ (mac) / Ctrl+Alt (win/linux).
    const isMac = window.__PLATFORM === "darwin";

    // Single source of truth for every app action — consumed by the command
    // palette (core/palette.js) and the cheat-sheet. `keys` are display-only.
    const kk = (mac, win) => (isMac ? mac : win);
    window.__actions = [
        { id: "newTab",      cat: "tabs",      label: "act.newTab",      keys: kk("⌘T", "Ctrl+Shift+T"),        run: () => term.newTab() },
        { id: "reopenTab",   cat: "tabs",      label: "act.reopenTab",   keys: kk("⌘⇧T", "Ctrl+Shift+O"),       run: () => term.reopenClosedTab() },
        { id: "closeTab",    cat: "tabs",      label: "act.closeTab",    keys: kk("⌘W", "Ctrl+Shift+W"),        run: () => term.closeFocusedPane() },
        { id: "renameTab",   cat: "tabs",      label: "act.renameTab",   keys: "F2",                            run: () => term.renameActiveTab() },
        { id: "nextTab",     cat: "tabs",      label: "act.nextTab",     keys: kk("⌘1–9", ""),                  run: () => { if (term.tabs.length) term.focusTab((term.active + 1) % term.tabs.length); } },
        { id: "prevTab",     cat: "tabs",      label: "act.prevTab",     keys: "",                              run: () => { if (term.tabs.length) term.focusTab((term.active - 1 + term.tabs.length) % term.tabs.length); } },
        { id: "splitV",      cat: "panes",     label: "act.splitV",      keys: kk("⌘D", "Ctrl+Shift+D"),        run: () => term.splitFocused("vertical") },
        { id: "splitH",      cat: "panes",     label: "act.splitH",      keys: kk("⌘⇧D", "Ctrl+Shift+H"),       run: () => term.splitFocused("horizontal") },
        { id: "zoom",        cat: "panes",     label: "act.zoom",        keys: kk("⌘⇧↵", "Ctrl+Shift+↵"),       run: () => term.toggleZoom() },
        { id: "focusLeft",   cat: "panes",     label: "act.focusLeft",   keys: kk("⌘⌥←", "Ctrl+Alt+←"),         run: () => term.focusDir("left") },
        { id: "focusRight",  cat: "panes",     label: "act.focusRight",  keys: kk("⌘⌥→", "Ctrl+Alt+→"),         run: () => term.focusDir("right") },
        { id: "focusUp",     cat: "panes",     label: "act.focusUp",     keys: kk("⌘⌥↑", "Ctrl+Alt+↑"),         run: () => term.focusDir("up") },
        { id: "focusDown",   cat: "panes",     label: "act.focusDown",   keys: kk("⌘⌥↓", "Ctrl+Alt+↓"),         run: () => term.focusDir("down") },
        { id: "broadcast",   cat: "panes",     label: "act.broadcast",   keys: kk("⌘⌥I", "Ctrl+Alt+I"),         run: () => term.toggleBroadcast() },
        { id: "clear",       cat: "terminal",  label: "act.clear",       keys: kk("⌘⇧K", "Ctrl+Shift+L"),       run: () => term.clearFocused() },
        { id: "reset",       cat: "terminal",  label: "act.reset",       keys: kk("⌘⌥⇧K", "Ctrl+Alt+Shift+K"),  run: () => term.resetFocused() },
        { id: "find",        cat: "terminal",  label: "act.find",        keys: kk("⌘F", "Ctrl+Shift+F"),        run: () => toggleSearch() },
        { id: "fontInc",     cat: "view",      label: "act.fontInc",     keys: kk("⌘=", "Ctrl+Shift+="),        run: () => term.adjustFont(1) },
        { id: "fontDec",     cat: "view",      label: "act.fontDec",     keys: kk("⌘-", "Ctrl+Shift+-"),        run: () => term.adjustFont(-1) },
        { id: "fontReset",   cat: "view",      label: "act.fontReset",   keys: kk("⌘0", "Ctrl+Shift+0"),        run: () => term.resetFont() },
        { id: "fullscreen",  cat: "view",      label: "act.fullscreen",  keys: kk("⌘↵", "F11"),                 run: () => window.dyo.win("toggleFullscreen") },
        { id: "themes",      cat: "app",       label: "act.themes",      keys: kk("⌘K", "Ctrl+Shift+K"),        run: () => openThemes() },
        { id: "layouts",     cat: "dashboard", label: "act.layouts",     keys: "",                              run: () => cycleLayout() },
        { id: "addWidget",   cat: "dashboard", label: "act.addWidget",   keys: "",                              run: () => window.dash.openCatalog() },
        { id: "editWidgets", cat: "dashboard", label: "act.editWidgets", keys: kk("⌘E", "Ctrl+Shift+E"),        run: () => toggleEdit() },
        { id: "toggleDash",  cat: "dashboard", label: "act.toggleDash",  keys: "",                              run: () => toggleDash() },
        { id: "dockCycle",   cat: "dashboard", label: "act.dockCycle",   keys: "",                              run: () => cycleDock() },
        { id: "cheatsheet",  cat: "app",       label: "act.cheatsheet",  keys: kk("⌘/", "Ctrl+Shift+/"),        run: () => openCheatSheet() },
        { id: "palette",     cat: "app",       label: "act.palette",     keys: kk("⌘⇧P", "Ctrl+Shift+P"),       run: () => openPalette() }
    ];

    // Primary (⌘ / Ctrl+Shift) shortcuts.
    window.addEventListener("keydown", e => {
        if (!isMac && e.key === "F11") { e.preventDefault(); window.dyo.win("toggleFullscreen"); return; }
        if (e.key === "F2") { e.preventDefault(); term.renameActiveTab(); return; }
        const primary = isMac ? e.metaKey : (e.ctrlKey && e.shiftKey && !e.altKey); // !altKey: AltGr reports ctrl+alt on Windows
        if (!primary) return;
        const k = (e.key || "").toLowerCase();
        const code = e.code || "";
        const digit = /^Digit([1-9])$/.exec(code);
        if (k === "t") { e.preventDefault(); if (isMac && e.shiftKey) term.reopenClosedTab(); else term.newTab(); }
        else if (!isMac && k === "o") { e.preventDefault(); term.reopenClosedTab(); }
        else if (k === "w") { e.preventDefault(); term.closeFocusedPane(); }
        else if (k === "f") { e.preventDefault(); toggleSearch(); }
        else if (k === "e") { e.preventDefault(); toggleEdit(); }
        else if (k === "p") { e.preventDefault(); openPalette(); }
        else if (code === "Slash" || k === "/" || k === "?") { e.preventDefault(); openCheatSheet(); }
        else if (k === "k") { e.preventDefault(); if (isMac && e.shiftKey) term.clearFocused(); else openThemes(); }
        else if (!isMac && k === "l") { e.preventDefault(); term.clearFocused(); }
        else if (code === "Equal") { e.preventDefault(); term.adjustFont(1); }
        else if (code === "Minus") { e.preventDefault(); term.adjustFont(-1); }
        else if (code === "Digit0") { e.preventDefault(); term.resetFont(); }
        else if (digit) { e.preventDefault(); term.focusTab(parseInt(digit[1], 10) - 1); }
        else if (k === "enter") { e.preventDefault(); if (e.shiftKey) term.toggleZoom(); else if (isMac) window.dyo.win("toggleFullscreen"); }
        else if (k === "d") { e.preventDefault(); term.splitFocused(isMac && e.shiftKey ? "horizontal" : "vertical"); }
        else if (!isMac && k === "h") { e.preventDefault(); term.splitFocused("horizontal"); }
    });

    // Pane navigation / resize / broadcast — ⌥ (mac) or Ctrl+Alt (win/linux).
    window.addEventListener("keydown", e => {
        const altMod = isMac ? (e.metaKey && e.altKey) : (e.ctrlKey && e.altKey);
        if (!altMod) return;
        const k = (e.key || "").toLowerCase();
        const arrow = { arrowleft: "left", arrowright: "right", arrowup: "up", arrowdown: "down" }[k];
        if (arrow) { e.preventDefault(); if (e.shiftKey) term.resizeFocused(arrow); else term.focusDir(arrow); }
        else if (k === "i" && !e.shiftKey) { e.preventDefault(); term.toggleBroadcast(); }
        else if (k === "k" && e.shiftKey) { e.preventDefault(); term.resetFocused(); }
    });

    // Copy/paste in form fields (the OS menu deliberately doesn't grab these keys
    // so the terminal can copy its own selection — see core/terminal.js). Handled
    // here for inputs/textareas; skips the terminal panes, which handle their own.
    document.addEventListener("keydown", async e => {
        const k = (e.key || "").toLowerCase();
        const copy = isMac ? (e.metaKey && !e.shiftKey && k === "c") : (e.ctrlKey && e.shiftKey && !e.altKey && k === "c");
        const paste = isMac ? (e.metaKey && !e.shiftKey && k === "v") : (e.ctrlKey && e.shiftKey && !e.altKey && k === "v");
        if (!copy && !paste) return;
        const ae = document.activeElement;
        if (!ae || (ae.closest && ae.closest(".pane"))) return; // terminal handles itself
        const isField = ae.tagName === "INPUT" || ae.tagName === "TEXTAREA";
        if (!isField && !ae.isContentEditable) return;
        // selectionStart/End throw on input types without selection support (number/date/email…)
        const selRange = (el) => { try { return [el.selectionStart, el.selectionEnd]; } catch (_) { return null; } };
        if (copy) {
            const r = isField ? selRange(ae) : null;
            let text = isField ? (r ? ae.value.substring(r[0], r[1]) : ae.value) : String(window.getSelection());
            if (text) { e.preventDefault(); navigator.clipboard.writeText(text).catch(() => {}); }
        } else if (paste) {
            e.preventDefault();
            const t = await navigator.clipboard.readText().catch(() => "");
            if (t && isField) {
                const r = selRange(ae);
                if (r) {
                    ae.value = ae.value.slice(0, r[0]) + t + ae.value.slice(r[1]);
                    ae.selectionStart = ae.selectionEnd = r[0] + t.length;
                } else {
                    ae.value = t; // no selection API — replace the whole value
                }
                ae.dispatchEvent(new Event("input", { bubbles: true }));
            } else if (t) {
                document.execCommand("insertText", false, t); // contentEditable
            }
        }
    }, true);
})();

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}
