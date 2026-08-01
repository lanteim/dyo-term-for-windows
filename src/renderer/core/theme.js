"use strict";
// Theme engine: maps a theme JSON onto CSS custom properties and the xterm
// theme object. Themes come from the main process (builtin + user overrides).
window.ThemeEngine = {
    themes: {},
    current: null,
    _listeners: [],

    async load() {
        this.themes = await window.dyo.themes.list();
        return this.themes;
    },

    onChange(cb) { this._listeners.push(cb); },

    apply(name) {
        const theme = this.themes[name];
        if (!theme) return;
        this.current = name;
        const c = theme.colors;
        const root = document.documentElement.style;
        root.setProperty("--bg", c.bg);
        root.setProperty("--bg-panel", c.bgPanel);
        root.setProperty("--bg-elevated", c.bgElevated);
        root.setProperty("--border", c.border);
        root.setProperty("--border-strong", c.borderStrong);
        root.setProperty("--accent", c.accent);
        root.setProperty("--accent2", c.accent2);
        root.setProperty("--danger", c.danger);
        root.setProperty("--text", c.text);
        root.setProperty("--text-dim", c.textDim);
        root.setProperty("--grid", c.grid);
        root.setProperty("--terminal-bg", theme.terminal.background);
        this._listeners.forEach(cb => cb(theme));
    },

    terminalTheme() {
        const t = this.themes[this.current];
        return t ? t.terminal : {};
    }
};
