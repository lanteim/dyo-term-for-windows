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
        this.catalog.innerHTML = `<div class="dialog" style="width:min(760px,95vw)">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
                <h2 data-i18n="catalog.title" style="margin:0">Widget Catalog</h2>
                <span id="catalog-count" style="color:var(--text-dim);font-size:12px"></span>
                <span style="flex:1"></span>
                <input id="catalog-search" data-i18n-ph="catalog.search" placeholder="Search widgets…" autocomplete="off" spellcheck="false" style="width:200px">
                <button id="catalog-sort" class="chip" title="Toggle A–Z / by category">A–Z</button>
            </div>
            <div id="catalog-cats" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px"></div>
            <div id="catalog-body" style="max-height:60vh;overflow:auto"></div>
        </div>`;
        document.body.appendChild(this.catalog);
        this.catalog.addEventListener("click", e => { if (e.target.id === "catalog-overlay") this.catalog.classList.remove("open"); });
        host.querySelector("#open-catalog").onclick = () => this.openCatalog();

        // Catalog view state
        this._cat = { q: "", category: "all", alpha: false };
        const search = this.catalog.querySelector("#catalog-search");
        search.addEventListener("input", () => { this._cat.q = search.value.trim().toLowerCase(); this._renderCatalog(); });
        search.addEventListener("keydown", e => { if (e.key === "Escape") this.catalog.classList.remove("open"); });
        this.catalog.querySelector("#catalog-sort").onclick = (e) => {
            this._cat.alpha = !this._cat.alpha;
            e.currentTarget.classList.toggle("active", this._cat.alpha);
            e.currentTarget.textContent = this._cat.alpha ? "A–Z ✓" : "A–Z";
            this._renderCatalog();
        };

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
        this.catalog.classList.add("open");
        this._renderCatalog();
        const search = this.catalog.querySelector("#catalog-search");
        setTimeout(() => search && search.focus(), 30);
    }

    _catLabel(cat) {
        const l = window.I18N.t("cat." + cat);
        return (l === "cat." + cat) ? cat : l; // fall back to raw category if no translation
    }

    _renderCatalog() {
        const t = window.I18N.t.bind(window.I18N);
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const all = Object.values(window.WIDGETS);
        const cats = [...new Set(all.map(w => w.category || "other"))].sort();

        // ---- category filter chips (with counts) ----
        const catsEl = this.catalog.querySelector("#catalog-cats");
        const chip = (id, label, count, active) =>
            `<span class="chip cat-chip${active ? " active" : ""}" data-cat="${id}">${esc(label)}${count != null ? ` <b style="opacity:.6">${count}</b>` : ""}</span>`;
        let chipsHtml = chip("all", t("catalog.all"), all.length, this._cat.category === "all");
        cats.forEach(c => chipsHtml += chip(c, this._catLabel(c), all.filter(w => (w.category || "other") === c).length, this._cat.category === c));
        catsEl.innerHTML = chipsHtml;
        catsEl.querySelectorAll(".cat-chip").forEach(el => el.onclick = () => { this._cat.category = el.dataset.cat; this._renderCatalog(); });

        // ---- filter ----
        const q = this._cat.q;
        let items = all.filter(w => {
            if (this._cat.category !== "all" && (w.category || "other") !== this._cat.category) return false;
            if (!q) return true;
            const name = t(w.title).toLowerCase();
            return name.includes(q) || (w.id || "").toLowerCase().includes(q) || (w.description || "").toLowerCase().includes(q) || (w.category || "").toLowerCase().includes(q);
        });

        const bodyEl = this.catalog.querySelector("#catalog-body");
        this.catalog.querySelector("#catalog-count").textContent = `${items.length} / ${all.length}`;

        const card = w =>
            `<div class="cat-item" data-id="${w.id}" title="${esc(w.id)}">
                <div style="color:var(--accent);font-size:13px">${esc(t(w.title))}</div>
                <div style="color:var(--text-dim);font-size:10.5px;margin-top:3px">${esc(w.description || "")}</div>
            </div>`;
        const gridOpen = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px">`;

        let html = "";
        if (items.length === 0) {
            html = `<div style="padding:20px;color:var(--text-dim);text-align:center">No widgets match “${esc(q)}”.</div>`;
        } else if (this._cat.alpha) {
            // ---- alphabetical: A–Z with letter headers + a quick-jump index ----
            items.sort((a, b) => t(a.title).localeCompare(t(b.title)));
            const byLetter = {};
            items.forEach(w => { const L = (t(w.title)[0] || "#").toUpperCase(); (byLetter[L] = byLetter[L] || []).push(w); });
            const letters = Object.keys(byLetter).sort();
            html += `<div id="catalog-az" style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:10px">` +
                letters.map(L => `<span class="az-jump" data-l="${L}" style="cursor:pointer;padding:1px 5px;border-radius:4px;color:var(--accent2);font-size:11px">${L}</span>`).join("") + `</div>`;
            letters.forEach(L => {
                html += `<div class="az-head" data-letter="${L}" style="margin:12px 0 6px;color:var(--text-dim);font-size:12px;font-weight:700">${L}</div>${gridOpen}`;
                byLetter[L].forEach(w => html += card(w));
                html += `</div>`;
            });
        } else {
            // ---- grouped by category ----
            const groups = {};
            items.forEach(w => { const c = w.category || "other"; (groups[c] = groups[c] || []).push(w); });
            Object.keys(groups).sort().forEach(c => {
                groups[c].sort((a, b) => t(a.title).localeCompare(t(b.title)));
                html += `<div style="margin:12px 0 6px;color:var(--text-dim);font-size:11px;letter-spacing:1.5px;text-transform:uppercase">${esc(this._catLabel(c))} <span style="opacity:.5">(${groups[c].length})</span></div>${gridOpen}`;
                groups[c].forEach(w => html += card(w));
                html += `</div>`;
            });
        }
        bodyEl.innerHTML = html;

        bodyEl.querySelectorAll(".cat-item").forEach(el => {
            el.onclick = () => { this.addWidget(el.dataset.id, { autoPosition: true }, true); this.catalog.classList.remove("open"); };
        });
        bodyEl.querySelectorAll(".az-jump").forEach(el => el.onclick = () => {
            const head = bodyEl.querySelector(`.az-head[data-letter="${el.dataset.l}"]`);
            if (head) head.scrollIntoView({ behavior: "smooth", block: "start" });
        });
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
