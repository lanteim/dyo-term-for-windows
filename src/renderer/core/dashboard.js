"use strict";
// Widget dashboard built on Gridstack (MIT). Edit mode lets you drag, resize,
// add and remove widgets iOS-style; the layout persists to settings.

class Dashboard {
    constructor(host, settings) {
        this.settings = settings;
        this.mounted = new Map(); // itemEl -> {widgetId, instance}
        host.innerHTML = `
            <div id="editbar">
                <button id="open-catalog" class="chip" data-i18n="edit.add">Add widget</button>
                <span class="hint" data-i18n="edit.hint">Drag by header · resize from edges · ✕ to remove</span>
            </div>
            <div class="grid-stack"></div>`;
        this.gridEl = host.querySelector(".grid-stack");

        // Categorized widget catalog (default is minimal; users add from here)
        this.catalog = document.createElement("div");
        this.catalog.className = "overlay";
        this.catalog.id = "catalog-overlay";
        this.catalog.innerHTML = `<div class="dialog"><h2 data-i18n="catalog.title">Widget Catalog</h2><div id="catalog-body"></div></div>`;
        document.body.appendChild(this.catalog);
        this.catalog.addEventListener("click", e => { if (e.target.id === "catalog-overlay") this.catalog.classList.remove("open"); });
        host.querySelector("#open-catalog").onclick = () => this.openCatalog();

        this.grid = window.GridStack.init({
            column: 12,
            cellHeight: 70,
            margin: 6,
            float: false,
            handle: ".widget > header",
            staticGrid: true,
            animate: true
        }, this.gridEl);

        this.grid.on("change", () => this.persist());

        const saved = settings.layout;
        if (saved && Array.isArray(saved.items) && saved.items.length) {
            saved.items.forEach(it => this.addWidget(it.widgetId, it, false));
        } else {
            this._defaultLayout();
        }
    }

    // Minimal by default — everything else is opt-in via the catalog
    _defaultLayout() {
        this.addWidget("clock", { x: 0, y: 0, w: 12, h: 2 }, false);
        this.addWidget("sysmon", { x: 0, y: 2, w: 12, h: 4 }, false);
        this.addWidget("notes", { x: 0, y: 6, w: 12, h: 4 }, false);
        this.persist();
    }

    openCatalog() {
        const bodyEl = this.catalog.querySelector("#catalog-body");
        // Group widget definitions by category
        const groups = {};
        Object.values(window.WIDGETS).forEach(w => {
            const cat = w.category || "other";
            (groups[cat] = groups[cat] || []).push(w);
        });
        let html = "";
        Object.keys(groups).sort().forEach(cat => {
            html += `<div style="margin:14px 0 8px;color:var(--text-dim);font-size:11px;letter-spacing:1.5px;text-transform:uppercase">${window.I18N.t("cat." + cat) || cat}</div>`;
            html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px">`;
            groups[cat].forEach(w => {
                html += `<div class="cat-item" data-id="${w.id}" style="border:1px solid var(--border);border-radius:8px;padding:10px;cursor:pointer">
                    <div style="color:var(--accent);font-size:13px">${window.I18N.t(w.title)}</div>
                    <div style="color:var(--text-dim);font-size:10.5px;margin-top:3px">${w.description || ""}</div>
                </div>`;
            });
            html += `</div>`;
        });
        bodyEl.innerHTML = html;
        bodyEl.querySelectorAll(".cat-item").forEach(el => {
            el.onmouseenter = () => el.style.borderColor = "var(--accent)";
            el.onmouseleave = () => el.style.borderColor = "var(--border)";
            el.onclick = () => { this.addWidget(el.dataset.id, { autoPosition: true }, true); this.catalog.classList.remove("open"); };
        });
        this.catalog.classList.add("open");
    }

    addWidget(widgetId, pos, persist) {
        const def = window.WIDGETS[widgetId];
        if (!def) return;
        const size = def.defaultSize || { w: 6, h: 3 };
        const opts = {
            w: pos.w || size.w, h: pos.h || size.h,
            x: pos.x, y: pos.y,
            autoPosition: pos.autoPosition || (pos.x == null),
            id: widgetId + ":" + Math.random().toString(36).slice(2, 7)
        };

        const content = document.createElement("div");
        content.className = "widget";
        content.innerHTML = `<header><span class="title" data-i18n="${def.title}">${window.I18N.t(def.title)}</span><span class="sub"></span><span class="remove">${window.ICONS.close}</span></header><div class="body"></div>`;

        const item = this.grid.addWidget(Object.assign({}, opts, { content: "" }));
        const contentHost = item.querySelector(".grid-stack-item-content");
        contentHost.appendChild(content);
        item.gridstackNode.dyoWidget = widgetId;

        content.querySelector(".remove").onclick = (e) => {
            e.stopPropagation();
            this.removeItem(item);
        };

        const instance = def.mount(content.querySelector(".body"));
        this.mounted.set(item, { widgetId, instance });
        if (persist) this.persist();
    }

    removeItem(item) {
        const rec = this.mounted.get(item);
        if (rec && rec.instance && rec.instance.destroy) rec.instance.destroy();
        this.mounted.delete(item);
        this.grid.removeWidget(item);
        this.persist();
    }

    setEditing(on) {
        document.body.classList.toggle("editing", on);
        this.grid.setStatic(!on);
    }

    persist() {
        const items = [];
        this.grid.engine.nodes.forEach(n => {
            items.push({ widgetId: n.dyoWidget, x: n.x, y: n.y, w: n.w, h: n.h });
        });
        this.settings.layout = { items };
        window.dyo.settings.set({ layout: this.settings.layout });
    }
}

window.Dashboard = Dashboard;
