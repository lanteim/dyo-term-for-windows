"use strict";
// Terminal engine: unlimited tabs, each tab a tree of split panes (iTerm-style).
// Every pane is an xterm instance backed by a pty in the main process over IPC.

const { Terminal } = window;           // UMD globals from vendor scripts
const { FitAddon } = window.FitAddon;
const { SearchAddon } = window.SearchAddon;
const { WebLinksAddon } = window.WebLinksAddon;

class TerminalPane {
    constructor(manager) {
        this.manager = manager;
        this.id = null;
        this._disposed = false;
        this.el = document.createElement("div");
        this.el.className = "pane";
        this.host = document.createElement("div");
        this.host.className = "xterm-host";
        this.el.appendChild(this.host);

        const s = manager.settings;
        this.term = new Terminal({
            allowProposedApi: true,
            fontFamily: `"${s.fontFamily || "JetBrains Mono"}", ui-monospace, Menlo, monospace`,
            fontSize: s.fontSize || 14,
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

        this.el.addEventListener("mousedown", () => manager.focusPane(this), true);
        this.term.onData(d => { if (this.id) window.dyo.pty.input(this.id, d); });

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
                navigator.clipboard.readText().then(t => {
                    if (t) this.term.paste(t);
                }).catch(() => {});
                return false;
            }
            // App shortcuts (⌘… on mac, Ctrl+Shift+… on win/linux) are handled by
            // the window keydown handler; don't let xterm also send them to the pty.
            if (isMac ? e.metaKey : (e.ctrlKey && e.shiftKey)) return false;
            return true;
        });

        this._ro = new ResizeObserver(() => this.fit());
        this._ro.observe(this.host);

        this.spawn();
    }

    async spawn() {
        this.fit();
        const dims = this.fitAddon.proposeDimensions() || { cols: 80, rows: 24 };
        const res = await window.dyo.pty.spawn({
            cwd: this.manager.lastCwd,
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
            const tab = this.manager.activeTab();
            if (cwd && tab && tab.focused === this && cwd !== this.manager.lastCwd) {
                this.manager.lastCwd = cwd;
                this.manager.updateTitle();
            }
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
    constructor(manager) {
        this.manager = manager;
        this.container = document.createElement("div");
        this.container.className = "split vertical";
        this.container.style.flex = "1";
        const pane = new TerminalPane(manager);
        this.root = { pane };
        this.focused = pane;
        this._mount();
    }

    _mount() {
        this.container.innerHTML = "";
        this.container.appendChild(this._render(this.root, this.container));
        requestAnimationFrame(() => this._fitAll(this.root));
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

    updateTitle() { this.renderTabs(); }

    renderTabs() {
        this.tabsWrap.innerHTML = "";
        this.tabs.forEach((tab, idx) => {
            const el = document.createElement("div");
            el.className = "tab" + (idx === this.active ? " active" : "");
            const short = (this.lastCwd || "~").split("/").pop() || "/";
            el.innerHTML = `<span class="dot"></span><span class="label">${idx + 1}: ${escapeHtml(idx === this.active ? short : "shell")}</span>`;
            const close = document.createElement("span");
            close.className = "close";
            close.innerHTML = window.ICONS.close;
            close.onclick = (e) => { e.stopPropagation(); this.closeTab(idx); };
            el.appendChild(close);
            el.onclick = () => this.focusTab(idx);
            this.tabsWrap.appendChild(el);
        });
    }

    search(query) {
        const t = this.activeTab();
        if (t && t.focused) t.focused.searchAddon.findNext(query, { regex: false, caseSensitive: false });
    }

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

window.TerminalManager = TerminalManager;
