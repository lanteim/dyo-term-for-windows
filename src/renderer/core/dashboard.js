"use strict";
// Widget dashboard built on Gridstack (MIT). Edit mode lets you drag, resize,
// add and remove widgets iOS-style; the layout persists to settings.

// ── Responsive tuning knobs (kept together so density/columns are easy to tune) ──
// The layout is authored & persisted in a canonical 12-column space; the *visual*
// column count scales up on wide monitors so widgets never over-stretch.
const DYO_BASE_COL = 12;        // canonical persistence space — NEVER changes
const DYO_MAX_COL = 30;         // widest we ever reflow to
const DYO_COL_STEP = 6;         // snap columns to multiples of 6 → half-width (w6) and
                                // full-width (w12) widgets tile with no dead space
const DYO_COL_LAYOUT = "list";  // GridStack reflow mode. 'list' keeps each widget's cell
                                // footprint and repacks more per row (the goal). NOT
                                // 'moveScale' (that just scales widgets 50%→50%, no fix).
// Per-density: GridStack cellHeight (px), inter-widget margin (px), and the target
// dash-px per grid column used to pick the column count. Smaller `cell` → more columns.
const DYO_DENSITY = {
    compact:     { cellHeight: 56, margin: 4,  cell: 50 },
    comfortable: { cellHeight: 70, margin: 6,  cell: 60 }, // == current look (default)
    spacious:    { cellHeight: 88, margin: 10, cell: 76 },
};
// With cell 60 the four common monitor classes (dash ≈ 560 / 958 / 1293 / 1931 px)
// map cleanly to 12 / 18 / 24 / 30 columns; compact/spacious shift those thresholds.

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
        this.host = host;
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

        // Restore saved density (default = comfortable, i.e. the current look).
        this.density = DYO_DENSITY[settings.density] ? settings.density : "comfortable";
        this._colCssDone = new Set([1, 12]); // GridStack only ships width CSS for gs-1 / gs-12
        const dp0 = DYO_DENSITY[this.density];
        document.body.classList.add("density-" + this.density);

        this.grid = window.GridStack.init({
            column: DYO_BASE_COL,
            cellHeight: dp0.cellHeight,
            margin: dp0.margin,
            float: false,
            handle: ".widget > header",
            staticGrid: true,
            animate: true
        }, this.gridEl);

        // Persist on genuine user gestures only. Skip programmatic reflow (adaptive
        // columns / density) and layout loads so the saved 12-col coordinates are
        // never overwritten with wide-screen coordinates. isIgnoreChangeCB() is set
        // by GridStack while a column() reflow fires its change event.
        this.grid.on("change", () => { if (this._reflowing || this._loading || this.grid.isIgnoreChangeCB()) return; this.persist(); });

        // Adaptive columns: watch the dash-col width and reflow the visual column
        // count so widgets stay a comfortable size on wide/ultrawide monitors.
        // Debounced; the persisted layout stays in 12-col space (see persist()).
        this._ro = new ResizeObserver(() => { clearTimeout(this._roTimer); this._roTimer = setTimeout(() => this._syncColumns(), 120); });
        this._ro.observe(this.host);

        // Keep the "last updated" chrome labels fresh (relative time) and flag any
        // widget whose data has gone stale — now - lastUpdated > max(3·interval, 15s)
        // → dim the body + show an amber STALE marker (btop/glances-style). Skipped
        // for collapsed widgets, which legitimately stop updating.
        setInterval(() => {
            if (!window.APWidget) return;
            const now = Date.now();
            this.gridEl.querySelectorAll(".w-updated[data-ts]").forEach(el => {
                const ts = Number(el.dataset.ts);
                if (ts) el.textContent = window.APWidget.fmt.ago(ts);
                const widget = el.closest(".widget");
                if (!widget) return;
                const item = el.closest(".grid-stack-item");
                const iv = Number(el.dataset.interval) || 0;
                const collapsed = item && item.classList.contains("apw-collapsed");
                const stale = !!(ts && iv && !collapsed && (now - ts) > Math.max(3 * iv, 15000));
                widget.classList.toggle("stale", stale);
            });
        }, 5000);

        // Keyboard shortcuts on the focused/hovered widget (r/e/c/1-4). One
        // document listener, added once for the dashboard's lifetime.
        this._hoverItem = null;
        this._onKey = (e) => this._handleKey(e);
        document.addEventListener("keydown", this._onKey);

        // Layout profiles: named layouts you can switch between. Migrate any
        // pre-existing single layout into a "Default" profile.
        this.layouts = (settings.layouts && typeof settings.layouts === "object") ? settings.layouts : {};
        if (!Object.keys(this.layouts).length) {
            this.layouts = { "Default": { items: (settings.layout && settings.layout.items) || [], dock: settings.dashDock || "right" } };
        }
        this.activeLayout = (settings.activeLayout && this.layouts[settings.activeLayout]) ? settings.activeLayout : Object.keys(this.layouts)[0];
        this._loadLayout(this.activeLayout, false);

        // The dock button (app.js cycleDock) only saves the global dashDock and
        // never persists the layout profile — mirror dock changes into the active
        // layout. Armed on a tick so the boot dock apply above runs first.
        setTimeout(() => {
            new MutationObserver(() => {
                const cur = window.__dashDock ? window.__dashDock() : null;
                const L = this.layouts[this.activeLayout];
                if (cur && L && L.dock !== cur) this.persist();
            }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
        }, 0);
    }

    listLayouts() { return Object.keys(this.layouts); }

    clearAll() {
        [...this.mounted.keys()].forEach(item => {
            const rec = this.mounted.get(item);
            if (rec && rec.instance && rec.instance.destroy) rec.instance.destroy();
            this.mounted.delete(item);
        });
        this.grid.removeAll();
    }

    _loadLayout(name, save) {
        if (!this.layouts[name]) return;
        this.clearAll();
        // Saved coordinates are authored in the canonical 12-col space — reset the
        // grid to 12 before placing widgets, then reflow to the width-appropriate count.
        if (this.grid.getColumn() !== DYO_BASE_COL) { this._reflowing = true; try { this.grid.column(DYO_BASE_COL, "none"); } finally { this._reflowing = false; } }
        this.activeLayout = name;
        const L = this.layouts[name];
        this._loading = true;
        if (L.items && L.items.length) L.items.forEach(it => this.addWidget(it.widgetId, it, false));
        else if (name === "Default" && !L.seeded) this._defaultLayout(); // seed only once — an emptied Default stays empty
        this._loading = false;
        if (name === "Default" && !L.seeded) { L.seeded = true; this.persist(); } // write the seeded/migrated layout now
        this._syncColumns(); // adapt the visual column count to the current dash width
        if (L.dock) {
            if (window.__setDock) window.__setDock(L.dock);
            // at boot the constructor runs before app.js defines __setDock — apply on a tick
            else setTimeout(() => { if (window.__setDock) window.__setDock(L.dock); }, 0);
        }
        if (save) { this.settings.activeLayout = name; window.dyo.settings.set({ activeLayout: name }); }
    }

    switchLayout(name) { if (this.layouts[name]) this._loadLayout(name, true); }

    newLayout(name) {
        name = (name || "").trim() || ("Layout " + (this.listLayouts().length + 1));
        if (this.layouts[name]) name += " " + Math.random().toString(36).slice(2, 5);
        this.layouts[name] = { items: [], dock: window.__dashDock ? window.__dashDock() : "right" };
        this._loadLayout(name, true);
        this.persist();
        return name;
    }

    deleteLayout(name) {
        if (!this.layouts[name] || this.listLayouts().length <= 1) return;
        delete this.layouts[name];
        if (this.activeLayout === name) this._loadLayout(this.listLayouts()[0], true);
        this.persist();
    }

    renameLayout(oldName, newName) {
        newName = (newName || "").trim();
        if (!this.layouts[oldName] || !newName || this.layouts[newName]) return;
        this.layouts[newName] = this.layouts[oldName];
        delete this.layouts[oldName];
        if (this.activeLayout === oldName) this.activeLayout = newName;
        this.persist();
    }

    // Minimal by default — everything else is opt-in via the catalog
    _defaultLayout() {
        this.addWidget("clock", { x: 0, y: 0, w: 12, h: 2 }, false);
        this.addWidget("sysmon", { x: 0, y: 2, w: 12, h: 4 }, false);
        this.addWidget("notes", { x: 0, y: 6, w: 12, h: 4 }, false);
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
        if (pos.collapsed) opts.h = 1; // saved h is the expanded height; render one row

        const content = document.createElement("div");
        content.className = "widget";
        content.innerHTML = `<header>
            <span class="title" data-i18n="${def.title}">${window.I18N.t(def.title)}</span>
            <span class="w-alert"></span>
            <span class="sub"></span>
            <span class="w-updated" title="Last updated"></span>
            <span class="w-stale" data-i18n="apw.stale"></span>
            <span class="w-tools">
                <button class="w-btn w-refresh" title="Refresh" style="display:none">${window.ICONS.reload}</button>
                <button class="w-btn w-settings" title="Settings" style="display:none">${window.ICONS.settings}</button>
                <button class="w-btn w-collapse" title="Collapse / expand">${window.ICONS.chevron}</button>
                <button class="w-btn remove" title="Close">${window.ICONS.close}</button>
            </span>
        </header><div class="body"></div>`;

        const item = this.grid.addWidget(Object.assign({}, opts, { content: "" }));
        const contentHost = item.querySelector(".grid-stack-item-content");
        contentHost.appendChild(content);
        item.gridstackNode.dyoWidget = widgetId;
        if (pos.collapsed) { item.classList.add("apw-collapsed"); item.dataset.prevh = pos.h || size.h; }

        content.querySelector(".remove").onclick = (e) => {
            e.stopPropagation();
            this.removeItem(item);
        };

        // Collapse / expand — shrink the grid cell down to just the header.
        content.querySelector(".w-collapse").onclick = (e) => {
            e.stopPropagation();
            const collapsed = item.classList.toggle("apw-collapsed");
            if (collapsed) { item.dataset.prevh = item.gridstackNode.h; this.grid.update(item, { h: 1 }); }
            else { this.grid.update(item, { h: Number(item.dataset.prevh) || 3 }); }
        };

        // Frame API — A.Petrov-style widgets use this to light up refresh/settings
        // buttons and report their last-updated time in the standard chrome.
        const refreshBtn = content.querySelector(".w-refresh");
        const settingsBtn = content.querySelector(".w-settings");
        const updatedEl = content.querySelector(".w-updated");
        const alertEl = content.querySelector(".w-alert");
        const staleEl = content.querySelector(".w-stale");
        if (staleEl) staleEl.textContent = window.I18N.t("apw.stale");
        const frame = {
            onRefresh: (fn) => { refreshBtn.style.display = ""; refreshBtn.onclick = (e) => { e.stopPropagation(); fn(); }; },
            onSettings: (fn) => { settingsBtn.style.display = ""; settingsBtn.onclick = (e) => { e.stopPropagation(); fn(); }; },
            setBusy: (b) => refreshBtn.classList.toggle("spin", !!b),
            // ts + the widget's current interval (drives the stale-data detector below);
            // a fresh update also clears any lingering .stale marker immediately.
            setUpdated: (ts, interval) => {
                updatedEl.dataset.ts = ts || 0;
                if (interval) updatedEl.dataset.interval = interval;
                updatedEl.textContent = window.APWidget ? window.APWidget.fmt.ago(ts) : "";
                content.classList.remove("stale");
            },
            // threshold state → header alert dot (visible even when collapsed)
            setAlert: (level) => {
                if (!alertEl) return;
                alertEl.className = "w-alert" + (level === "warn" || level === "crit" ? " on " + level : "");
                alertEl.title = level === "crit" ? "Critical threshold breached" : level === "warn" ? "Warning threshold" : "";
            },
            setStale: (on) => content.classList.toggle("stale", !!on),
        };

        // Track hover so keyboard shortcuts act on the widget under the pointer.
        content.addEventListener("mouseenter", () => { this._hoverItem = item; });
        content.addEventListener("mouseleave", () => { if (this._hoverItem === item) this._hoverItem = null; });

        const instance = def.mount(content.querySelector(".body"), frame);
        this.mounted.set(item, { widgetId, instance });
        if (persist) this.persist();
    }

    removeItem(item) {
        if (this._hoverItem === item) this._hoverItem = null;
        const rec = this.mounted.get(item);
        if (rec && rec.instance && rec.instance.destroy) rec.instance.destroy();
        this.mounted.delete(item);
        this.grid.removeWidget(item);
        this.persist();
    }

    // Keyboard shortcuts scoped to the focused/hovered widget. Never hijacks typing
    // in inputs or while an overlay (catalog/settings) is focused.
    _handleKey(e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const tgt = e.target;
        if (tgt && tgt.closest && tgt.closest("input, textarea, select, [contenteditable='true'], .overlay")) return;
        let item = (document.activeElement && document.activeElement.closest) ? document.activeElement.closest(".grid-stack-item") : null;
        if (!item) item = this._hoverItem;
        if (!item) return;
        const widget = item.querySelector(".widget");
        if (!widget) return;
        const k = e.key;
        let handled = true;
        if (k === "r" || k === "R") {
            const b = widget.querySelector(".w-refresh");
            if (b && b.style.display !== "none") b.click();
            else { const rec = this.mounted.get(item); if (rec && rec.instance && rec.instance.refresh) rec.instance.refresh(); else handled = false; }
        } else if (k === "e" || k === "E") {
            const b = widget.querySelector(".apw-export"); if (b) b.click(); else handled = false;
        } else if (k === "c" || k === "C") {
            const b = widget.querySelector(".w-collapse"); if (b) b.click(); else handled = false;
        } else if (k === "1" || k === "2" || k === "3" || k === "4") {
            const rs = widget.querySelectorAll(".apw-range"); const b = rs[Number(k) - 1]; if (b) b.click(); else handled = false;
        } else {
            handled = false;
        }
        if (handled) { e.preventDefault(); e.stopPropagation(); }
    }

    setEditing(on) {
        document.body.classList.toggle("editing", on);
        this.grid.setStatic(!on);
    }

    // ---- responsive: adaptive columns + density ------------------------------

    // GridStack ships item-width CSS only for gs-1 / gs-12 (extra.css covers 2–11).
    // For any wider count we generate the width/left rules once, on demand.
    _ensureColCss(n) {
        if (this._colCssDone.has(n)) return;
        this._colCssDone.add(n);
        let css = `.gs-${n}>.grid-stack-item{width:${(100 / n).toFixed(4)}%}\n`; // w=1 writes no gs-w attr
        for (let w = 2; w <= n; w++) css += `.gs-${n}>.grid-stack-item[gs-w="${w}"]{width:${(w * 100 / n).toFixed(4)}%}\n`;
        for (let x = 1; x < n; x++) css += `.gs-${n}>.grid-stack-item[gs-x="${x}"]{left:${(x * 100 / n).toFixed(4)}%}\n`;
        let el = document.getElementById("dyo-col-css");
        if (!el) { el = document.createElement("style"); el.id = "dyo-col-css"; document.head.appendChild(el); }
        el.textContent += css;
    }

    // Column count from dash width: aim for a comfortable cell, snap to DYO_COL_STEP,
    // clamp to [12, 30]. Never goes below 12 so small screens are unchanged.
    _targetColumns(width) {
        const cell = (DYO_DENSITY[this.density] || DYO_DENSITY.comfortable).cell;
        const cols = Math.round(width / cell / DYO_COL_STEP) * DYO_COL_STEP;
        return Math.max(DYO_BASE_COL, Math.min(DYO_MAX_COL, cols || DYO_BASE_COL));
    }

    _syncColumns() {
        if (!this.grid || this._loading) return;
        const w = this.gridEl.clientWidth || this.host.clientWidth || 0;
        if (w < 40) return; // dashboard hidden/collapsed — leave the column count as-is
        const target = this._targetColumns(w);
        if (target === this.grid.getColumn()) return;
        this._ensureColCss(target);
        this._reflowing = true;
        try { this.grid.column(target, DYO_COL_LAYOUT); } finally { this._reflowing = false; }
    }

    setDensity(name) { if (DYO_DENSITY[name] && name !== this.density) this._applyDensity(name, true); }

    _applyDensity(name, save) {
        const d = DYO_DENSITY[name] || DYO_DENSITY.comfortable;
        document.body.classList.remove("density-compact", "density-comfortable", "density-spacious");
        document.body.classList.add("density-" + name);
        this.density = name;
        if (this.grid) {
            this.grid.cellHeight(d.cellHeight);
            this.grid.margin(d.margin);
            this._syncColumns(); // density shifts the column thresholds — re-evaluate
        }
        if (save) { this.settings.density = name; window.dyo.settings.set({ density: name }); }
    }

    persist() {
        if (this._loading) return;
        const C = this.grid.getColumn(), B = DYO_BASE_COL;
        const items = [];
        this.grid.engine.nodes.forEach(n => {
            // Save logical state: the expanded height + a collapsed flag, not h:1.
            const collapsed = !!(n.el && n.el.classList.contains("apw-collapsed"));
            let x = n.x, w = n.w;
            if (C !== B) { // displayed at an adaptive column count — normalize widths/x back to 12-col space
                w = Math.max(1, Math.min(B, Math.round(n.w * B / C)));
                x = Math.max(0, Math.min(B - w, Math.round(n.x * B / C)));
            }
            const it = { widgetId: n.dyoWidget, x, y: n.y, w, h: collapsed ? (Number(n.el.dataset.prevh) || n.h) : n.h };
            if (collapsed) it.collapsed = true;
            items.push(it);
        });
        if (!this.layouts[this.activeLayout]) this.layouts[this.activeLayout] = {};
        this.layouts[this.activeLayout].items = items;
        this.layouts[this.activeLayout].dock = window.__dashDock ? window.__dashDock() : (this.layouts[this.activeLayout].dock || "right");
        this.settings.layouts = this.layouts;
        this.settings.layout = { items }; // legacy mirror for older reads
        window.dyo.settings.set({ layouts: this.layouts, activeLayout: this.activeLayout, layout: this.settings.layout });
    }
}

window.Dashboard = Dashboard;
