"use strict";
// Terminal engine: unlimited tabs, each tab a tree of split panes (iTerm-style).
// Every pane is an xterm instance backed by a pty in the main process over IPC.

const { Terminal } = window;           // UMD globals from vendor scripts
const { FitAddon } = window.FitAddon;
const { SearchAddon } = window.SearchAddon;
const { WebLinksAddon } = window.WebLinksAddon;

class TerminalPane {
    constructor(manager, opts = {}) {
        this.manager = manager;
        this.id = null;
        this._disposed = false;
        this._spawnCwd = opts.cwd || null;   // restored cwd for reopened tabs
        this.paneCwd = opts.cwd || null;      // last known cwd, tracked by the poll
        this.oscTitle = null;                 // title the shell/program sets (OSC 0/2)
        this.el = document.createElement("div");
        this.el.className = "pane";
        this.host = document.createElement("div");
        this.host.className = "xterm-host";
        this.el.appendChild(this.host);

        const s = manager.settings;
        this.term = new Terminal({
            allowProposedApi: true,
            fontFamily: `"${s.fontFamily || "JetBrains Mono"}", ui-monospace, Menlo, monospace`,
            fontSize: manager.fontSize || s.fontSize || 14,
            cursorBlink: s.cursorBlink !== false,
            cursorStyle: s.cursorStyle || "bar",
            scrollback: 5000,
            theme: window.ThemeEngine.terminalTheme(),
            macOptionIsMeta: true
        });
        this.fitAddon = new FitAddon();
        this.searchAddon = new SearchAddon();
        this.term.loadAddon(this.fitAddon);
        this.term.loadAddon(this.searchAddon);
        this.term.loadAddon(new WebLinksAddon((e, uri) => window.dyo.openExternal(uri)));
        this.term.open(this.host);
        if (!window.__DYO_NOWEBGL) {
            try {
                const { WebglAddon } = window.WebglAddon;
                const webgl = new WebglAddon();
                webgl.onContextLoss(() => webgl.dispose());
                this.term.loadAddon(webgl);
            } catch (e) { /* DOM renderer fallback */ }
        }

        // Unicode 11 grapheme widths (emoji / CJK / combining marks line up right)
        try {
            const U = window.Unicode11Addon;
            const U11 = U && (U.Unicode11Addon || U);
            if (U11) {
                this.term.loadAddon(new U11());
                this.term.unicode.activeVersion = "11";
            }
        } catch (e) { /* unicode addon optional */ }

        // Keep scrollback across `clear` / reset. `clear` (and some Ctrl+L bindings)
        // emit ESC[3J = "erase scrollback"; swallow just that so, like iTerm, clearing
        // the screen doesn't throw away the history you may want to scroll back to.
        // ED 0/1/2 (erase in display) still run normally.
        try {
            this.term.parser.registerCsiHandler({ final: "J" }, (params) => params[0] === 3);
        } catch (e) { /* parser API optional */ }

        // Tab label follows the title the shell/program sets (OSC 0/2), like iTerm.
        this.term.onTitleChange((t) => {
            this.oscTitle = (t || "").trim() || null;
            this.manager.updateTitle();
        });

        this.el.addEventListener("mousedown", () => manager.focusPane(this), true);
        // Origin keystrokes go to this pty; broadcast mode mirrors them to siblings.
        this.term.onData(d => {
            if (!this.id) return;
            window.dyo.pty.input(this.id, d);
            this.manager.maybeBroadcast(this, d);
        });

        // Terminal copy/paste on the native keys, copying xterm's own selection
        // (works with the WebGL renderer, where the DOM selection is empty):
        //   macOS      — ⌘C copies the selection, ⌘V pastes
        //   Windows/Linux — Ctrl+Shift+C / Ctrl+Shift+V  (so Ctrl+C stays SIGINT)
        const isMac = window.__PLATFORM === "darwin";
        this.term.attachCustomKeyEventHandler(e => {
            if (e.type !== "keydown") return true;
            const key = (e.key || "").toLowerCase();
            const copyCombo = isMac ? (e.metaKey && !e.shiftKey && key === "c")
                                    : (e.ctrlKey && e.shiftKey && key === "c");
            const pasteCombo = isMac ? (e.metaKey && !e.shiftKey && key === "v")
                                     : (e.ctrlKey && e.shiftKey && key === "v");
            if (copyCombo) {
                const sel = this.term.getSelection();
                if (sel) {
                    navigator.clipboard.writeText(sel).catch(() => {});
                    return false;
                }
                // macOS ⌘C with no selection: swallow so it isn't sent to the pty
                if (isMac) return false;
            }
            if (pasteCombo) {
                // ⌘V (mac) also fires a native `paste` event that the handler on
                // `host` below turns into a single guarded paste — pasting here too
                // would double it. Win/Linux Ctrl+Shift+V may not emit a paste event,
                // so read the clipboard explicitly there.
                if (!isMac) {
                    navigator.clipboard.readText().then(t => {
                        if (t) this.manager.guardedPaste(this, t);
                    }).catch(() => {});
                }
                return false;
            }
            // App shortcuts (⌘… on mac, Ctrl+Shift+… on win/linux) are handled by
            // the window keydown handler; don't let xterm also send them to the pty.
            if (isMac ? e.metaKey : (e.ctrlKey && e.shiftKey)) return false;
            // Win/Linux pane nav + broadcast use Ctrl+Alt; keep them out of the shell.
            if (!isMac && e.ctrlKey && e.altKey &&
                (key === "i" || key === "arrowleft" || key === "arrowright" ||
                 key === "arrowup" || key === "arrowdown")) return false;
            return true;
        });

        // Single source of truth for pasting: ⌘V/Ctrl+V, context-menu and middle-click
        // all surface here as a native `paste` event. We stop it in the capture phase —
        // before xterm's own textarea handler — so xterm doesn't *also* paste (that
        // double was the bug), then route the text through the multiline guard.
        this.host.addEventListener("paste", e => {
            e.preventDefault();
            e.stopPropagation();
            const text = e.clipboardData && e.clipboardData.getData("text");
            if (text) this.manager.guardedPaste(this, text);
        }, true);

        // Scrollback wheel scrolling. xterm 6's overlay scroller doesn't reliably
        // catch the wheel over the WebGL canvas, so drive scrollback ourselves in the
        // normal buffer (the alt buffer belongs to vim/less/htop, which get the wheel
        // forwarded by xterm). Capture phase + stopPropagation → no double scroll.
        this.host.addEventListener("wheel", (e) => {
            if (this.term.buffer.active.type !== "normal") return; // alt buffer → let xterm/app handle
            if (e.ctrlKey || e.metaKey) return;                    // reserved combos (zoom, etc.)
            e.preventDefault();
            e.stopPropagation();
            let lines;
            if (e.deltaMode === 1) lines = e.deltaY;                       // DOM_DELTA_LINE
            else if (e.deltaMode === 2) lines = e.deltaY * this.term.rows; // DOM_DELTA_PAGE
            else {                                                         // DOM_DELTA_PIXEL — accumulate for smooth trackpad
                const cell = (this.term._core && this.term._core._renderService
                    && this.term._core._renderService.dimensions.css.cell.height) || 18;
                this._wheelPx = (this._wheelPx || 0) + e.deltaY;
                const whole = this._wheelPx < 0 ? Math.ceil(this._wheelPx / cell) : Math.floor(this._wheelPx / cell);
                this._wheelPx -= whole * cell;
                lines = whole;
            }
            const n = lines < 0 ? Math.floor(lines) : Math.ceil(lines);
            if (n) this.term.scrollLines(n);
        }, { capture: true, passive: false });

        this._ro = new ResizeObserver(() => this.fit());
        this._ro.observe(this.host);

        this.spawn();
    }

    async spawn() {
        this.fit();
        const dims = this.fitAddon.proposeDimensions() || { cols: 80, rows: 24 };
        const res = await window.dyo.pty.spawn({
            cwd: this._spawnCwd || this.manager.lastCwd,
            cols: dims.cols || 80,
            rows: dims.rows || 24
        });
        if (this._disposed) { window.dyo.pty.kill(res.id); return; }
        this.id = res.id;
        window.dyo.pty.onData(this.id, data => this.term.write(data));
        window.dyo.pty.onExit(this.id, () => this.manager.onPaneExit(this));
        this.term.onResize(({ cols, rows }) => { if (this.id) window.dyo.pty.resize(this.id, cols, rows); });
        // Track cwd for the title + new panes
        this._cwdTimer = setInterval(async () => {
            if (!this.id) return;
            const cwd = await window.dyo.pty.cwd(this.id);
            if (cwd && cwd !== this.paneCwd) {
                this.paneCwd = cwd;              // per-pane cwd (tab label + reopen)
                if (!this.oscTitle) this.manager.updateTitle();  // refresh this tab's label
            }
            const tab = this.manager.activeTab();
            if (cwd && tab && tab.focused === this) this.manager.lastCwd = cwd; // spawn cwd for new panes
        }, 2000);
    }

    fit() {
        try {
            const d = this.fitAddon.proposeDimensions();
            if (d && d.cols && d.rows) this.term.resize(d.cols, d.rows);
        } catch (e) { /* not visible yet */ }
    }

    focus() { this.term.focus(); }

    dispose() {
        if (this._disposed) return;
        this._disposed = true;
        clearInterval(this._cwdTimer);
        this._ro.disconnect();
        if (this.id) { window.dyo.pty.off(this.id); window.dyo.pty.kill(this.id); }
        this.id = null;
        this.term.dispose();
        this.el.remove();
    }
}

// A tab owns a tree of nodes: {pane} leaf, or {dir, a, b, split} internal.
class Tab {
    constructor(manager, spec) {
        this.manager = manager;
        this.container = document.createElement("div");
        this.container.className = "split vertical";
        this.container.style.flex = "1";
        this.customName = (spec && spec.customName) || null;   // survives the cwd poll
        this.broadcast = false;
        this.zoomed = false;
        this.zoomEl = null;
        if (spec && spec.root) {
            const build = n => n.dir
                ? { dir: n.dir, sizes: (n.sizes || [0.5, 0.5]).slice(), a: build(n.a), b: build(n.b) }
                : { pane: new TerminalPane(manager, { cwd: n.cwd }) };
            this.root = build(spec.root);
        } else {
            this.root = { pane: new TerminalPane(manager) };
        }
        this.focused = this._firstPane(this.root);
        this._mount();
    }

    _mount() {
        if (this.zoomed) {
            this.zoomed = false;
            this.zoomEl = null;
            this.container.classList.remove("zoomed");
            this.panes().forEach(p => p.el.classList.remove("zoom-target"));
        }
        this.container.innerHTML = "";
        this.container.appendChild(this._render(this.root, this.container));
        this._applyBroadcastUI();
        requestAnimationFrame(() => this._fitAll(this.root));
    }

    // Maximize the focused pane to fill the whole tab; toggle again to restore the
    // exact split tree. Panes stay mounted (visibility only) so no pty is recreated.
    toggleZoom() {
        if (this.zoomed) {
            this.container.classList.remove("zoomed");
            if (this.zoomEl) this.zoomEl.classList.remove("zoom-target");
            this.zoomed = false;
            this.zoomEl = null;
        } else {
            const p = this.focused;
            if (!p || this.panes().length < 2) return;   // single pane already fills
            p.el.classList.add("zoom-target");
            this.container.classList.add("zoomed");
            this.zoomed = true;
            this.zoomEl = p.el;
        }
        requestAnimationFrame(() => { this._fitAll(this.root); if (this.focused) this.focused.focus(); });
    }

    setBroadcast(on) { this.broadcast = !!on; this._applyBroadcastUI(); }

    _applyBroadcastUI() {
        this.container.classList.toggle("broadcasting", this.broadcast);
        let banner = this.container.querySelector(":scope > .broadcast-banner");
        if (this.broadcast && !banner) {
            banner = document.createElement("div");
            banner.className = "broadcast-banner";
            banner.textContent = window.I18N ? window.I18N.t("broadcast.banner") : "BROADCASTING";
            this.container.appendChild(banner);
        } else if (!this.broadcast && banner) {
            banner.remove();
        }
    }

    _render(node) {
        if (node.pane) return node.pane.el;
        const wrap = document.createElement("div");
        wrap.className = "split " + (node.dir === "horizontal" ? "horizontal" : "vertical");
        const aEl = this._render(node.a);
        aEl.style.flex = (node.sizes ? node.sizes[0] : 1) + " 1 0";
        const splitter = document.createElement("div");
        splitter.className = "splitter";
        const bEl = this._render(node.b);
        bEl.style.flex = (node.sizes ? node.sizes[1] : 1) + " 1 0";
        this._wireSplitter(splitter, aEl, bEl, node);
        wrap.append(aEl, splitter, bEl);
        return wrap;
    }

    _wireSplitter(splitter, aEl, bEl, node) {
        splitter.addEventListener("mousedown", e => {
            e.preventDefault();
            const horiz = node.dir === "horizontal";
            const parent = splitter.parentElement;
            const rect = parent.getBoundingClientRect();
            const total = horiz ? rect.height : rect.width;
            const move = ev => {
                const pos = horiz ? (ev.clientY - rect.top) : (ev.clientX - rect.left);
                let ratio = Math.min(0.85, Math.max(0.15, pos / total));
                node.sizes = [ratio, 1 - ratio];
                aEl.style.flex = ratio + " 1 0";
                bEl.style.flex = (1 - ratio) + " 1 0";
            };
            const up = () => {
                document.removeEventListener("mousemove", move);
                document.removeEventListener("mouseup", up);
                this._fitAll(this.root);
            };
            document.addEventListener("mousemove", move);
            document.addEventListener("mouseup", up);
        });
    }

    _fitAll(node) {
        if (node.pane) { node.pane.fit(); return; }
        this._fitAll(node.a); this._fitAll(node.b);
    }

    _findParent(node, target) {
        if (node.pane) return null;
        if (node.a === target || node.b === target) return node;
        return this._findParent(node.a, target) || this._findParent(node.b, target);
    }

    split(dir) {
        const target = this.focused;
        const leaf = this._findLeaf(this.root, target);
        if (!leaf) return;
        const newPane = new TerminalPane(this.manager);
        const newNode = { dir, a: { pane: target }, b: { pane: newPane }, sizes: [0.5, 0.5] };
        if (this.root === leaf) this.root = newNode;
        else {
            const parent = this._findParent(this.root, leaf);
            if (parent.a === leaf) parent.a = newNode; else parent.b = newNode;
        }
        this.focused = newPane;
        this._mount();
        newPane.focus();
    }

    _findLeaf(node, targetPane) {
        if (node.pane === targetPane) return node;
        if (node.pane) return null;
        return this._findLeaf(node.a, targetPane) || this._findLeaf(node.b, targetPane);
    }

    closePane(pane) {
        const leaf = this._findLeaf(this.root, pane);
        if (!leaf) return false;
        pane.dispose();
        if (this.root === leaf) return true; // whole tab is empty now
        const parent = this._findParent(this.root, leaf);
        const sibling = parent.a === leaf ? parent.b : parent.a;
        const grand = this._findParent(this.root, parent);
        if (!grand) this.root = sibling;
        else if (grand.a === parent) grand.a = sibling; else grand.b = sibling;
        this.focused = this._firstPane(sibling);
        this._mount();
        if (this.focused) this.focused.focus();
        return false;
    }

    _firstPane(node) { return node.pane ? node.pane : this._firstPane(node.a); }

    panes() {
        const out = [];
        (function walk(n) { if (n.pane) out.push(n.pane); else { walk(n.a); walk(n.b); } })(this.root);
        return out;
    }

    disposeAll() { this.panes().forEach(p => p.dispose()); }
}

class TerminalManager {
    constructor(settings) {
        this.settings = settings;
        this.lastCwd = settings.cwd;
        this.homeDir = settings.cwd;   // shown as "~" in tab labels
        this._defaultFontSize = settings.fontSize || 14;
        const fs = settings.termFontSize;
        this.fontSize = (typeof fs === "number" && fs >= 8 && fs <= 28) ? fs : this._defaultFontSize;
        this.closedStack = [];   // serialized trees of recently-closed tabs (reopen)
        this.tabs = [];
        this.active = -1;
        this.tabbar = document.getElementById("tabbar");
        this.panesHost = document.getElementById("panes");
        this._buildTabbar();
        this.newTab();
    }

    _buildTabbar() {
        this.tabbar.innerHTML = "";
        this.tabsWrap = document.createElement("div");
        this.tabsWrap.style.display = "flex";
        this.tabsWrap.style.gap = "4px";
        this.tabsWrap.style.flex = "1";
        this.tabbar.appendChild(this.tabsWrap);
        const add = document.createElement("div");
        add.className = "tab newtab";
        add.innerHTML = window.ICONS.plus;
        add.title = "New tab (⌘T)";
        add.onclick = () => this.newTab();
        this.tabbar.appendChild(add);
    }

    newTab() {
        const tab = new Tab(this);
        this.tabs.push(tab);
        this.panesHost.appendChild(tab.container);
        this.focusTab(this.tabs.length - 1);
        this.renderTabs();
        setTimeout(() => tab.focused && tab.focused.focus(), 30);
    }

    focusTab(i) {
        if (i < 0 || i >= this.tabs.length) return;
        this.active = i;
        this.tabs.forEach((t, idx) => {
            t.container.style.display = idx === i ? "flex" : "none";
        });
        this.renderTabs();
        const tab = this.tabs[i];
        if (tab.focused) { tab._fitAll(tab.root); setTimeout(() => tab.focused.focus(), 10); }
        if (window.refreshMonitorHost) window.refreshMonitorHost(); // metrics follow the tab
    }

    closeTab(i) {
        const tab = this.tabs[i];
        if (!tab) return;
        const wasActive = i === this.active;
        this._pushClosed(tab);
        tab.disposeAll();
        tab.container.remove();
        this.tabs.splice(i, 1);
        if (this.tabs.length === 0) { this.newTab(); return; }
        if (wasActive) {
            this.focusTab(Math.max(0, i - 1));
        } else {
            if (i < this.active) this.active--;
            this.renderTabs();
        }
    }

    activeTab() { return this.tabs[this.active]; }

    focusPane(pane) {
        const tab = this.activeTab();
        if (!tab) return;
        tab.focused = pane;
        tab.panes().forEach(p => p.el.classList.toggle("focused", p === pane));
        if (window.refreshMonitorHost) window.refreshMonitorHost(); // metrics follow the focused pane
    }

    onPaneExit(pane) {
        const tab = this.tabs.find(t => t.panes().includes(pane));
        if (!tab) return;
        const emptied = tab.closePane(pane);
        if (emptied) this.closeTab(this.tabs.indexOf(tab));
    }

    splitFocused(dir) { const t = this.activeTab(); if (t) { t.split(dir); this.renderTabs(); } }

    closeFocusedPane() {
        const t = this.activeTab();
        if (!t) return;
        const emptied = t.closePane(t.focused);
        if (emptied) this.closeTab(this.active);
    }

    updateTitle() { if (this._renaming) return; this.renderTabs(); }

    // iTerm-style tab label: the title the shell/program set (OSC 0/2), else the
    // focused pane's working-directory basename ("~" for home), else a fallback.
    tabLabel(tab) {
        const pane = tab.focused;
        if (pane && pane.oscTitle) return pane.oscTitle;
        const cwd = (pane && (pane.paneCwd || pane._spawnCwd)) || this.lastCwd || "";
        if (this.homeDir && cwd === this.homeDir) return "~";
        const base = String(cwd).replace(/\/+$/, "").split("/").pop();
        return base || "shell";
    }

    renderTabs() {
        this.tabsWrap.innerHTML = "";
        this.tabs.forEach((tab, idx) => {
            const el = document.createElement("div");
            el.className = "tab" + (idx === this.active ? " active" : "") + (tab.broadcast ? " broadcasting" : "");
            el.draggable = true;
            const title = tab.customName || this.tabLabel(tab);
            el.innerHTML = `<span class="dot"></span><span class="label">${escapeHtml(title)}</span>`;
            const close = document.createElement("span");
            close.className = "close";
            close.innerHTML = window.ICONS.close;
            close.onclick = (e) => { e.stopPropagation(); this.closeTab(idx); };
            el.appendChild(close);
            el.onclick = () => this.focusTab(idx);
            el.ondblclick = (e) => { e.stopPropagation(); this._beginRename(idx, el); };
            // Drag to reorder
            el.addEventListener("dragstart", e => { this._dragIdx = idx; el.classList.add("dragging"); try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(idx)); } catch (_) {} });
            el.addEventListener("dragend", () => el.classList.remove("dragging"));
            el.addEventListener("dragover", e => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "move"; });
            el.addEventListener("drop", e => { e.preventDefault(); this._moveTab(this._dragIdx, idx); });
            this.tabsWrap.appendChild(el);
        });
    }

    // ---- inline tab rename (double-click or F2) ----
    _beginRename(idx, el) {
        const tab = this.tabs[idx];
        if (!tab || !el) return;
        const label = el.querySelector(".label");
        if (!label) return;
        this._renaming = true;
        const input = document.createElement("input");
        input.className = "tab-rename";
        input.value = tab.customName || "";
        input.placeholder = label.textContent;
        input.spellcheck = false;
        label.replaceWith(input);
        input.focus();
        input.select();
        const commit = (save) => {
            if (!this._renaming) return;
            this._renaming = false;
            if (save) tab.customName = input.value.trim() || null;
            this.renderTabs();
        };
        input.addEventListener("keydown", e => {
            e.stopPropagation();
            if (e.key === "Enter") { e.preventDefault(); commit(true); }
            else if (e.key === "Escape") { e.preventDefault(); commit(false); }
        });
        input.addEventListener("blur", () => commit(true));
        input.onclick = e => e.stopPropagation();
        input.ondblclick = e => e.stopPropagation();
    }

    renameActiveTab() {
        const el = this.tabsWrap.children[this.active];
        if (el) this._beginRename(this.active, el);
    }

    _moveTab(from, to) {
        if (from == null || from === to || from < 0 || to < 0 || from >= this.tabs.length || to >= this.tabs.length) { this._dragIdx = null; return; }
        const activeRef = this.tabs[this.active];
        const [moved] = this.tabs.splice(from, 1);
        this.tabs.splice(to, 0, moved);
        this.active = this.tabs.indexOf(activeRef);
        this._dragIdx = null;
        this.renderTabs();
    }

    // ---- reopen closed tab: serialize the split tree + each pane's cwd ----
    _pushClosed(tab) {
        try {
            const ser = n => n.pane
                ? { cwd: n.pane.paneCwd || n.pane._spawnCwd || this.lastCwd }
                : { dir: n.dir, sizes: n.sizes ? n.sizes.slice() : undefined, a: ser(n.a), b: ser(n.b) };
            this.closedStack.push({ root: ser(tab.root), customName: tab.customName });
            if (this.closedStack.length > 10) this.closedStack.shift();
        } catch (e) { /* ignore serialization issues */ }
    }

    reopenClosedTab() {
        const spec = this.closedStack.pop();
        if (!spec) return;
        const tab = new Tab(this, spec);
        this.tabs.push(tab);
        this.panesHost.appendChild(tab.container);
        this.focusTab(this.tabs.length - 1);
        this.renderTabs();
        setTimeout(() => tab.focused && tab.focused.focus(), 30);
    }

    // ---- pane zoom / broadcast / clear / reset ----
    toggleZoom() { const t = this.activeTab(); if (t) t.toggleZoom(); }

    toggleBroadcast() { const t = this.activeTab(); if (!t) return; t.setBroadcast(!t.broadcast); this.renderTabs(); }

    maybeBroadcast(origin, data) {
        const tab = this.tabs.find(t => t.broadcast && t.panes().includes(origin));
        if (!tab) return;
        tab.panes().forEach(p => { if (p !== origin && p.id) window.dyo.pty.input(p.id, data); });
    }

    clearFocused() { const t = this.activeTab(); if (t && t.focused) { t.focused.term.clear(); t.focused.focus(); } }
    resetFocused() { const t = this.activeTab(); if (t && t.focused) { t.focused.term.reset(); t.focused.focus(); } }

    // ---- multiline / large paste guard ----
    guardedPaste(pane, text) {
        if (!text) return;
        // A single user paste can surface through more than one event path (the
        // keydown handler and the native paste event); collapse identical text within
        // a short window so it reaches the shell exactly once.
        const now = (window.performance && performance.now) ? performance.now() : Date.now();
        if (this._lastPaste && this._lastPaste.text === text && now - this._lastPaste.t < 80) return;
        this._lastPaste = { text, t: now };
        if (!(text.includes("\n") || text.length > 1500)) { pane.term.paste(text); return; }
        showPasteGuard(text, () => { pane.term.paste(text); pane.focus(); });
    }

    // ---- live font zoom across every pane ----
    adjustFont(delta) { this.fontSize = Math.min(28, Math.max(8, this.fontSize + delta)); this._applyFont(); }
    resetFont() { this.fontSize = this._defaultFontSize; this._applyFont(); }
    _applyFont() {
        this.tabs.forEach(t => t.panes().forEach(p => { p.term.options.fontSize = this.fontSize; p.fit(); }));
        try { window.dyo.settings.set({ termFontSize: this.fontSize }); } catch (e) {}
    }

    // ---- directional pane navigation (nearest neighbour in the arrow direction) ----
    focusDir(dir) {
        const tab = this.activeTab();
        if (!tab) return;
        const panes = tab.panes();
        if (panes.length < 2 || !tab.focused) return;
        const cr = tab.focused.el.getBoundingClientRect();
        const cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
        let best = null, bestScore = Infinity;
        panes.forEach(p => {
            if (p === tab.focused) return;
            const r = p.el.getBoundingClientRect();
            const dx = (r.left + r.width / 2) - cx, dy = (r.top + r.height / 2) - cy;
            let ok, primary, secondary;
            if (dir === "left")       { ok = dx < -1; primary = -dx; secondary = Math.abs(dy); }
            else if (dir === "right") { ok = dx > 1;  primary = dx;  secondary = Math.abs(dy); }
            else if (dir === "up")    { ok = dy < -1; primary = -dy; secondary = Math.abs(dx); }
            else                      { ok = dy > 1;  primary = dy;  secondary = Math.abs(dx); }
            if (!ok) return;
            const score = primary + secondary * 2;   // prefer aligned + nearest
            if (score < bestScore) { bestScore = score; best = p; }
        });
        if (best) { this.focusPane(best); best.focus(); }
    }

    // ---- keyboard pane resize: nudge the nearest matching-axis split by ~3% ----
    resizeFocused(dir) {
        const tab = this.activeTab();
        if (!tab || !tab.focused) return;
        const wantDir = (dir === "left" || dir === "right") ? "vertical" : "horizontal";
        let node = tab._findLeaf(tab.root, tab.focused);
        if (!node) return;
        let parent = tab._findParent(tab.root, node);
        let split = null, fromA = false;
        while (parent) {
            if (parent.dir === wantDir) { split = parent; fromA = parent.a === node; break; }
            node = parent;
            parent = tab._findParent(tab.root, node);
        }
        if (!split) return;
        const sizes = split.sizes || [0.5, 0.5];
        const grow = (dir === "right" || dir === "down");   // grow the focused pane
        let ratio = sizes[0] + (grow ? 1 : -1) * (fromA ? 1 : -1) * 0.03;
        ratio = Math.min(0.9, Math.max(0.1, ratio));
        split.sizes = [ratio, 1 - ratio];
        tab._mount();
        if (tab.focused) tab.focused.focus();
    }

    // ---- search (Enter/Shift+Enter driven by app.js; decorations highlight all) ----
    _searchOptions(extra) {
        return Object.assign({
            regex: false, caseSensitive: false,
            decorations: {
                matchBackground: "#2f4a6b",
                matchBorder: "#4fd2ff",
                matchOverviewRuler: "#4fd2ff",
                activeMatchBackground: "#ffb547",
                activeMatchBorder: "#ffd089",
                activeMatchColorOverviewRuler: "#ffb547"
            }
        }, extra || {});
    }
    searchNext(query, incremental) {
        const p = this.activeTab() && this.activeTab().focused;
        if (!p) return;
        if (!query) { p.searchAddon.clearDecorations(); return; }
        p.searchAddon.findNext(query, this._searchOptions({ incremental: !!incremental }));
    }
    searchPrev(query) {
        const p = this.activeTab() && this.activeTab().focused;
        if (p && query) p.searchAddon.findPrevious(query, this._searchOptions());
    }
    searchClear() {
        const p = this.activeTab() && this.activeTab().focused;
        if (p) p.searchAddon.clearDecorations();
    }
    search(query) { this.searchNext(query); }

    // Type a command into the focused terminal (used by the macros widget)
    runInFocused(cmd) {
        const t = this.activeTab();
        if (t && t.focused && t.focused.id) window.dyo.pty.input(t.focused.id, cmd);
    }

    reloadThemeOnAll() {
        const theme = window.ThemeEngine.terminalTheme();
        this.tabs.forEach(t => t.panes().forEach(p => { p.term.options.theme = theme; }));
    }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}

// Multiline / large paste confirmation. Previews the text (truncated) before it
// reaches the shell, so a stray clipboard full of commands can't auto-run.
function showPasteGuard(text, onConfirm) {
    const t = k => (window.I18N ? window.I18N.t(k) : k);
    const lines = text.split("\n").length;
    const preview = text.length > 2000 ? text.slice(0, 2000) + "\n…" : text;
    const overlay = document.createElement("div");
    overlay.className = "overlay paste-guard open";
    overlay.innerHTML = `
        <div class="dialog paste-dialog">
            <h2>${escapeHtml(t("paste.title"))}</h2>
            <div class="paste-meta">${escapeHtml(t("paste.warn").replace("{lines}", lines).replace("{chars}", text.length))}</div>
            <pre class="paste-preview">${escapeHtml(preview)}</pre>
            <div class="paste-actions">
                <button class="pg-cancel">${escapeHtml(t("paste.cancel"))}</button>
                <button class="pg-ok">${escapeHtml(t("paste.confirm"))}</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector(".pg-cancel").onclick = close;
    overlay.querySelector(".pg-ok").onclick = () => { close(); onConfirm(); };
    overlay.addEventListener("mousedown", e => { if (e.target === overlay) close(); });
    overlay.addEventListener("keydown", e => {
        e.stopPropagation();
        if (e.key === "Escape") { e.preventDefault(); close(); }
        else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); close(); onConfirm(); }
    });
    overlay.querySelector(".pg-ok").focus();
}

window.TerminalManager = TerminalManager;
