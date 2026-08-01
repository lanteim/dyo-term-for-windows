"use strict";
// Minimal i18n. Default English; Russian pack included. Strings are looked up
// by key; DOM nodes tagged with data-i18n / data-i18n-title are translated in
// place by apply(). Widgets read strings via I18N.t at mount and are re-mounted
// on language change.
window.I18N = {
    lang: "en",
    _listeners: [],

    dict: {
        en: {
            "meta.cores": "cores",
            "btn.splitV": "Split vertical (⌘D)",
            "btn.splitH": "Split horizontal (⌘⇧D)",
            "btn.search": "Find (⌘F)",
            "btn.edit": "Edit widgets (⌘E)",
            "btn.themes": "Theme gallery (⌘K)",
            "btn.lang": "Language",
            "btn.fullscreen": "Fullscreen (⌘↵)",
            "btn.newtab": "New tab (⌘T)",
            "edit.add": "Add widget:",
            "edit.hint": "Drag by header · resize from edges · ✕ to remove",
            "gallery.title": "Theme Gallery",
            "lang.title": "Language",
            "find.placeholder": "find (regex ok)",
            "widget.clock": "Chronometer",
            "widget.sysmon": "System",
            "widget.netmon": "Network",
            "widget.nowplaying": "Apple Music",
            "widget.notes": "Notes",
            "widget.db": "Database",
            "widget.git": "Git",
            "widget.macros": "Macros",
            "widget.clipboard": "Clipboard",
            "widget.pomodoro": "Pomodoro",
            "widget.battery": "Battery",
            "catalog.title": "Widget Catalog",
            "cat.system": "System",
            "cat.network": "Network",
            "cat.git": "Git",
            "cat.db": "Databases",
            "cat.terminal": "Terminal",
            "cat.productivity": "Productivity",
            "cat.media": "Media",
            "sysmon.cpu": "CPU",
            "sysmon.mem": "MEMORY",
            "sysmon.load": "LOAD",
            "sysmon.uptime": "UPTIME",
            "net.state": "STATE",
            "net.iface": "IFACE",
            "net.down": "▼ DOWN",
            "net.up": "▲ UP",
            "net.online": "ONLINE",
            "net.offline": "OFFLINE",
            "np.notrunning": "Music not running",
            "np.nothing": "Nothing playing",
            "notes.placeholder": "Scratchpad — saved automatically",
            "tab.shell": "shell"
        },
        ru: {
            "meta.cores": "ядер",
            "btn.splitV": "Разделить вертикально (⌘D)",
            "btn.splitH": "Разделить горизонтально (⌘⇧D)",
            "btn.search": "Поиск (⌘F)",
            "btn.edit": "Редактировать виджеты (⌘E)",
            "btn.themes": "Галерея тем (⌘K)",
            "btn.lang": "Язык",
            "btn.fullscreen": "На весь экран (⌘↵)",
            "btn.newtab": "Новая вкладка (⌘T)",
            "edit.add": "Добавить виджет:",
            "edit.hint": "Тащи за шапку · меняй размер за края · ✕ чтобы убрать",
            "gallery.title": "Галерея тем",
            "lang.title": "Язык",
            "find.placeholder": "поиск (regex можно)",
            "widget.clock": "Хронометр",
            "widget.sysmon": "Система",
            "widget.netmon": "Сеть",
            "widget.nowplaying": "Apple Music",
            "widget.notes": "Заметки",
            "widget.db": "База данных",
            "widget.git": "Git",
            "widget.macros": "Макросы",
            "widget.clipboard": "Буфер обмена",
            "widget.pomodoro": "Помодоро",
            "widget.battery": "Батарея",
            "catalog.title": "Каталог виджетов",
            "cat.system": "Система",
            "cat.network": "Сеть",
            "cat.git": "Git",
            "cat.db": "Базы данных",
            "cat.terminal": "Терминал",
            "cat.productivity": "Продуктивность",
            "cat.media": "Медиа",
            "sysmon.cpu": "ЦП",
            "sysmon.mem": "ПАМЯТЬ",
            "sysmon.load": "НАГРУЗКА",
            "sysmon.uptime": "АПТАЙМ",
            "net.state": "СТАТУС",
            "net.iface": "ИНТЕРФЕЙС",
            "net.down": "▼ ВХОД",
            "net.up": "▲ ИСХОД",
            "net.online": "ОНЛАЙН",
            "net.offline": "ОФФЛАЙН",
            "np.notrunning": "Музыка не запущена",
            "np.nothing": "Ничего не играет",
            "notes.placeholder": "Блокнот — сохраняется автоматически",
            "tab.shell": "оболочка"
        }
    },

    languages: [{ code: "en", label: "English" }, { code: "ru", label: "Русский" }],

    t(key) {
        const l = this.dict[this.lang] || this.dict.en;
        return (key in l) ? l[key] : (this.dict.en[key] != null ? this.dict.en[key] : key);
    },

    // Widgets self-register their strings so parallel widget files never touch
    // this shared dictionary directly. pack = { en: {...}, ru: {...} }
    register(pack) {
        if (pack.en) Object.assign(this.dict.en, pack.en);
        if (pack.ru) Object.assign(this.dict.ru, pack.ru);
    },

    onChange(cb) { this._listeners.push(cb); },

    set(lang) {
        if (!this.dict[lang]) lang = "en";
        this.lang = lang;
        this.apply();
        this._listeners.forEach(cb => cb(lang));
    },

    apply(root = document) {
        root.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = this.t(el.getAttribute("data-i18n")); });
        root.querySelectorAll("[data-i18n-title]").forEach(el => { el.title = this.t(el.getAttribute("data-i18n-title")); });
        root.querySelectorAll("[data-i18n-ph]").forEach(el => { el.placeholder = this.t(el.getAttribute("data-i18n-ph")); });
        root.querySelectorAll("[data-i18n-prefix]").forEach(el => { el.textContent = "+ " + this.t(el.getAttribute("data-i18n-prefix")); });
    }
};
