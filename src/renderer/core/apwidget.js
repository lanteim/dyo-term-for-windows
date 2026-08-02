"use strict";
// ── A.Petrov-style widget framework ──────────────────────────────────────────
// A thin runtime that turns a declarative spec into a fully-featured dashboard
// widget: standardized chrome (title · refresh · settings · collapse · close ·
// last-updated), an independent, visibility-aware refresh loop that never blocks
// the UI, a per-series history ring buffer with 1/5/15/60-minute ranges + CSV
// export, a settings panel, and graceful "not available on this host" states.
//
// Usage (in a widget file):
//   window.APWidget.define({
//     id: "ap-cpu", title: "ap.cpu.title", category: "apetrov",
//     interval: 2000, history: true, ranges: true,
//     settings: [{ key: "interval", label: "Refresh (ms)", type: "number", default: 2000 }],
//     render(ctx) { ctx.body.innerHTML = `...<i data-ref="bar"></i>`; },
//     async update(ctx) { const load = await ctx.si("currentLoad"); ctx.ref.bar... ctx.push("cpu", v); },
//   });
//
// The runtime is self-contained and depends only on window.dyo, window.I18N and
// window.WIDGETS — no third-party code.

(function () {
    const RANGES = [
        { key: "1m", ms: 60 * 1000, label: "1m" },
        { key: "5m", ms: 5 * 60 * 1000, label: "5m" },
        { key: "15m", ms: 15 * 60 * 1000, label: "15m" },
        { key: "1h", ms: 60 * 60 * 1000, label: "1h" },
    ];
    const HIST_CAP_MS = 60 * 60 * 1000; // keep at most one hour of history

    // POSIX-quote args when relaying a local command over ssh to a remote host
    function shq(s) { return "'" + String(s == null ? "" : s).replace(/'/g, "'\\''") + "'"; }
    function shJoin(arr) { return arr.map(shq).join(" "); }

    // ---- formatting helpers, shared with widgets via ctx.fmt / APWidget.fmt ----
    const fmt = {
        bytes(n, digits = 1) {
            n = Number(n) || 0;
            const u = ["B", "KB", "MB", "GB", "TB", "PB"];
            let i = 0;
            while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
            return n.toFixed(n >= 100 || i === 0 ? 0 : digits) + " " + u[i];
        },
        bps(n) { return fmt.bytes(n) + "/s"; },
        pct(n) { return (Math.round((Number(n) || 0) * 10) / 10) + "%"; },
        num(n) { return (Number(n) || 0).toLocaleString(); },
        duration(sec) {
            sec = Math.max(0, Math.floor(Number(sec) || 0));
            const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
            if (d) return `${d}d ${h}h ${m}m`;
            if (h) return `${h}h ${m}m`;
            if (m) return `${m}m ${s}s`;
            return `${s}s`;
        },
        ago(ts) {
            if (!ts) return "—";
            const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
            if (s < 2) return "just now";
            if (s < 60) return s + "s ago";
            const m = Math.floor(s / 60);
            if (m < 60) return m + "m ago";
            return Math.floor(m / 60) + "h ago";
        },
        esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m])); },
    };

    // ---- lightweight canvas line/area graph over a time series ----------------
    function drawGraph(canvas, points, opts) {
        if (!canvas) return;
        opts = opts || {};
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (!w || !h) return; // hidden/collapsed or not laid out — canvas.width is dpr-scaled, never feed it back
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
            canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        }
        const g = canvas.getContext("2d");
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, w, h);
        if (!points || points.length < 2) return;
        const css = getComputedStyle(document.documentElement);
        const accent = (opts.color || css.getPropertyValue("--accent") || "#38bdf8").trim();
        const accent2 = (css.getPropertyValue("--accent2") || accent).trim();
        const now = Date.now();
        const span = opts.rangeMs || (now - points[0].t) || 1;
        const t0 = now - span;
        let min = opts.min, max = opts.max;
        if (min == null || max == null) {
            let lo = Infinity, hi = -Infinity;
            for (const p of points) { if (p.v < lo) lo = p.v; if (p.v > hi) hi = p.v; }
            if (min == null) min = 0;
            if (max == null) max = hi > 0 ? hi * 1.15 : 1;
            if (max <= min) max = min + 1;
        }
        const x = t => 2 + ((t - t0) / span) * (w - 4);
        const y = v => h - 2 - ((v - min) / (max - min)) * (h - 4);
        // area fill
        g.beginPath();
        g.moveTo(x(points[0].t), h);
        for (const p of points) g.lineTo(x(p.t), y(p.v));
        g.lineTo(x(points[points.length - 1].t), h);
        g.closePath();
        const grad = g.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, hexA(accent, 0.28));
        grad.addColorStop(1, hexA(accent, 0.02));
        g.fillStyle = grad;
        g.fill();
        // line
        g.beginPath();
        points.forEach((p, i) => { const px = x(p.t), py = y(p.v); i ? g.lineTo(px, py) : g.moveTo(px, py); });
        g.strokeStyle = accent2;
        g.lineWidth = 1.5;
        g.lineJoin = "round";
        g.stroke();
    }
    function hexA(color, a) {
        color = color.trim();
        if (color.startsWith("#")) {
            let c = color.slice(1);
            if (c.length === 3) c = c.split("").map(x => x + x).join("");
            const n = parseInt(c, 16);
            return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
        }
        return color; // already rgb()/named — fall back opaque-ish
    }

    // ---- per-widget settings persistence (namespaced under settings.apw) ------
    let _apwCache = null;
    async function loadAllSettings() {
        if (_apwCache) return _apwCache;
        const s = await window.dyo.settings.get().catch(() => ({}));
        _apwCache = (s && s.apw) || {};
        return _apwCache;
    }
    async function saveWidgetSettings(id, values) {
        const all = await loadAllSettings();
        all[id] = values;
        await window.dyo.settings.set({ apw: all }).catch(() => {});
    }

    // ---- the runtime ----------------------------------------------------------
    async function mount(spec, body, frame) {
        const id = spec.id;
        const st = {
            alive: true, visible: true, busy: false, lastUpdated: 0,
            hist: {}, range: (spec.defaultRange || 60 * 1000),
            settings: {},
        };
        // resolve settings values (defaults → saved)
        const schema = spec.settings || [];
        schema.forEach(f => { st.settings[f.key] = f.default; });
        const saved = (await loadAllSettings())[id];
        if (saved) Object.assign(st.settings, saved);
        let interval = Number(st.settings.interval) || spec.interval || 2000;

        // ── scaffold: optional history toolbar + content host ──
        body.classList.add("apw");
        body.innerHTML = "";
        const status = document.createElement("div");
        status.className = "apw-status";
        const content = document.createElement("div");
        content.className = "apw-content";
        let rangeBar = null;
        if (spec.ranges) {
            rangeBar = document.createElement("div");
            rangeBar.className = "apw-ranges";
            rangeBar.innerHTML = RANGES.map(r => `<button class="apw-range${r.ms === st.range ? " on" : ""}" data-ms="${r.ms}">${r.label}</button>`).join("")
                + `<span style="flex:1"></span><button class="apw-export" title="Export CSV">CSV</button>`;
            body.appendChild(rangeBar);
        }
        // host badge — which server this widget is currently reading (follows the tab)
        const hostBadge = document.createElement("div");
        hostBadge.className = "apw-host";
        const renderHost = () => { const h = window.__monitorHost; hostBadge.textContent = h ? ("⇅ " + h.label) : ""; hostBadge.style.display = h ? "block" : "none"; };
        body.appendChild(hostBadge);
        body.appendChild(content);
        body.appendChild(status);
        renderHost();

        // ── ctx handed to the widget ──
        const ctx = {
            id, body: content, root: body,
            si: (...a) => window.dyo.si(...a),
            get host() { return window.__monitorHost || null; },
            get remote() { return !!window.__monitorHost; },
            exec(cmd, args = [], opts = {}) {
                const h = window.__monitorHost;
                return h ? window.dyo.ssh(h.sshArgs, shJoin([cmd, ...(args || [])]), opts) : window.dyo.exec(cmd, args, opts);
            },
            sh(script, opts = {}) {
                const h = window.__monitorHost;
                // remotely wrap in `sh -c` so the script is parsed by POSIX sh even
                // when the remote user's login shell is csh/tcsh/fish
                return h ? window.dyo.ssh(h.sshArgs, "sh -c " + shq(String(script)), opts) : window.dyo.exec("/bin/sh", ["-c", String(script)], opts);
            },
            db: window.dyo.db, http: (...a) => window.dyo.http(...a), fsapi: window.dyo.fs,
            settings: st.settings, fmt,
            t: window.I18N.t.bind(window.I18N),
            ref: {},
            $(sel) { return content.querySelector(sel); },
            $$(sel) { return [...content.querySelectorAll(sel)]; },
            bindRefs() { ctx.ref = {}; content.querySelectorAll("[data-ref]").forEach(el => ctx.ref[el.getAttribute("data-ref")] = el); return ctx.ref; },
            push(key, v) {
                v = Number(v); if (!isFinite(v)) return;
                const arr = st.hist[key] || (st.hist[key] = []);
                const t = st.tick || Date.now(); // same stamp for every series of one update cycle
                arr.push({ t, v });
                const cut = t - HIST_CAP_MS;
                while (arr.length && arr[0].t < cut) arr.shift();
            },
            series(key) {
                const arr = st.hist[key] || [];
                const cut = Date.now() - st.range;
                return arr.filter(p => p.t >= cut);
            },
            graph(canvasOrRef, key, opts) {
                const cv = typeof canvasOrRef === "string" ? content.querySelector(canvasOrRef) : canvasOrRef;
                drawGraph(cv, ctx.series(key), Object.assign({ rangeMs: st.range }, opts || {}));
            },
            setStatus(text, kind) {
                status.textContent = text || "";
                status.className = "apw-status" + (kind ? " " + kind : "");
                status.style.display = text ? "block" : "none";
            },
            notAvailable(msg) {
                content.innerHTML = `<div class="apw-na">${fmt.esc(msg || "Not available on this host")}</div>`;
                ctx.setStatus("");
                st.degraded = true; // DOM was wiped — rebuild before the next successful update
            },
            get range() { return st.range; },
        };

        // ── build static DOM once ──
        try { spec.render(ctx); ctx.bindRefs(); } catch (e) { content.innerHTML = `<div class="apw-na">render error: ${fmt.esc(e.message)}</div>`; }

        // ── range + export wiring ──
        if (rangeBar) {
            rangeBar.querySelectorAll(".apw-range").forEach(b => b.onclick = () => {
                st.range = Number(b.dataset.ms);
                rangeBar.querySelectorAll(".apw-range").forEach(x => x.classList.toggle("on", x === b));
                redrawGraphs();
            });
            rangeBar.querySelector(".apw-export").onclick = () => exportCsv();
        }
        function redrawGraphs() { try { if (spec.redraw) spec.redraw(ctx); } catch (e) {} }
        function exportCsv() {
            const keys = Object.keys(st.hist);
            if (!keys.length) return;
            const rows = new Map(); // t -> {key:v}
            keys.forEach(k => st.hist[k].forEach(p => { const r = rows.get(p.t) || {}; r[k] = p.v; rows.set(p.t, r); }));
            const ts = [...rows.keys()].sort((a, b) => a - b);
            let csv = "timestamp," + keys.join(",") + "\n";
            ts.forEach(t => { csv += new Date(t).toISOString() + "," + keys.map(k => (rows.get(t)[k] != null ? rows.get(t)[k] : "")).join(",") + "\n"; });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
            a.download = id + "-history.csv";
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        }

        // ── refresh loop (visibility-aware, non-blocking, never overlapping) ──
        let inFlight = false;
        let epoch = 0;           // bumped on host change — discards in-flight results from the old host
        let pendingRefresh = false;
        let runtimeErr = false;  // error status was set by the runtime (not the widget)
        async function runUpdate(manual) {
            if (!st.alive || inFlight) return;
            if (!manual && (!st.visible || collapsed())) return; // idle when hidden → low CPU
            inFlight = true;
            if (frame && frame.setBusy) frame.setBusy(true);
            const e0 = epoch;
            try {
                // A prior notAvailable() wiped the widget's DOM — rebuild it so a
                // recovered update (e.g. after switching to an SSH host that works)
                // writes into live, re-bound nodes instead of detached ones.
                if (st.degraded) { try { spec.render(ctx); ctx.bindRefs(); } catch (e) {} st.degraded = false; }
                st.tick = Date.now(); // one timestamp per update cycle — keeps CSV rows aligned
                await spec.update(ctx);
                if (e0 !== epoch) { st.hist = {}; ctx._r = {}; return; } // stale: host changed mid-flight — drop its samples
                st.lastUpdated = Date.now();
                if (frame && frame.setUpdated) frame.setUpdated(st.lastUpdated);
                if (runtimeErr) { runtimeErr = false; if (status.classList.contains("err")) ctx.setStatus(""); }
                redrawGraphs();
            } catch (e) {
                if (e0 === epoch) { runtimeErr = true; ctx.setStatus(String((e && e.message) || e), "err"); }
            } finally {
                st.tick = 0;
                inFlight = false;
                if (frame && frame.setBusy) frame.setBusy(false);
                if (pendingRefresh) { pendingRefresh = false; runUpdate(true); }
            }
        }
        function collapsed() { return !!(body.closest(".grid-stack-item") || body).classList && (body.closest(".grid-stack-item") || {}).classList && body.closest(".grid-stack-item").classList.contains("apw-collapsed"); }

        // pause work when scrolled out of view
        let io = null;
        try {
            io = new IntersectionObserver(es => { st.visible = es.some(e => e.isIntersecting); if (st.visible) runUpdate(false); }, { threshold: 0.01 });
            io.observe(body);
        } catch (e) { st.visible = true; }

        // chrome hooks (dashboard renders the buttons)
        if (frame) {
            if (frame.onRefresh) frame.onRefresh(() => runUpdate(true));
            if (frame.onSettings && schema.length) frame.onSettings(() => openSettings());
        }

        let settingsOv = null; // open settings overlay, removed on destroy()
        function openSettings() {
            const ov = document.createElement("div");
            ov.className = "overlay open";
            ov.innerHTML = `<div class="dialog" style="width:min(440px,92vw)">
                <h2 style="margin:0 0 12px">${fmt.esc(window.I18N.t(spec.title))} — settings</h2>
                <div class="apw-form">${schema.map(f => fieldHtml(f, st.settings[f.key])).join("")}</div>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
                    <button class="chip" data-x="cancel">Cancel</button>
                    <button class="chip" data-x="save" style="border-color:var(--accent);color:var(--accent)">Save</button>
                </div></div>`;
            document.body.appendChild(ov);
            settingsOv = ov;
            const close = () => { ov.remove(); if (settingsOv === ov) settingsOv = null; };
            ov.addEventListener("click", e => { if (e.target === ov) close(); });
            ov.querySelector('[data-x="cancel"]').onclick = close;
            ov.querySelector('[data-x="save"]').onclick = async () => {
                if (!st.alive) { close(); return; } // widget was destroyed while the dialog was open
                schema.forEach(f => {
                    const el = ov.querySelector(`[name="${f.key}"]`);
                    if (!el) return;
                    let v = f.type === "checkbox" ? el.checked : el.value;
                    if (f.type === "number") v = Number(v);
                    st.settings[f.key] = v;
                });
                await saveWidgetSettings(id, st.settings);
                const ni = Number(st.settings.interval) || spec.interval || 2000;
                if (ni !== interval) { interval = ni; clearInterval(iv); iv = setInterval(() => runUpdate(false), interval); }
                if (spec.onSettings) try { spec.onSettings(ctx); } catch (e) {}
                close();
                runUpdate(true);
            };
        }
        function fieldHtml(f, val) {
            const lab = `<label>${fmt.esc(f.label || f.key)}</label>`;
            if (f.type === "select") return `<div class="apw-field">${lab}<select name="${f.key}">${(f.options || []).map(o => `<option value="${fmt.esc(o.value != null ? o.value : o)}"${(o.value != null ? o.value : o) == val ? " selected" : ""}>${fmt.esc(o.label != null ? o.label : o)}</option>`).join("")}</select></div>`;
            if (f.type === "checkbox") return `<div class="apw-field apw-check"><label><input type="checkbox" name="${f.key}"${val ? " checked" : ""}> ${fmt.esc(f.label || f.key)}</label></div>`;
            return `<div class="apw-field">${lab}<input type="${f.type === "number" ? "number" : "text"}" name="${f.key}" value="${fmt.esc(val == null ? "" : val)}" placeholder="${fmt.esc(f.placeholder || "")}"></div>`;
        }

        // when the active tab's ssh host changes, drop history (different server)
        // and re-read immediately so metrics track the tab.
        // Switching host: clear history AND rebuild the DOM to placeholders so the
        // previous host's values don't linger under the new host's badge while the
        // first remote read is in flight (or if it errors).
        const onHostChange = () => {
            epoch++; // invalidate any in-flight update against the previous host
            st.hist = {};
            ctx._r = {}; // drop rate-delta caches (apremote) — counters belong to the old host
            st.degraded = true;
            renderHost();
            if (inFlight) pendingRefresh = true; else runUpdate(true);
        };
        window.addEventListener("dyo-host-change", onHostChange);

        runUpdate(true);
        let iv = setInterval(() => runUpdate(false), interval);

        return {
            destroy() { st.alive = false; clearInterval(iv); if (io) io.disconnect(); window.removeEventListener("dyo-host-change", onHostChange); if (settingsOv) { settingsOv.remove(); settingsOv = null; } },
            refresh: () => runUpdate(true),
        };
    }

    window.APWidget = {
        RANGES, fmt, drawGraph,
        define(spec) {
            window.WIDGETS = window.WIDGETS || {};
            if (spec.i18n) window.I18N.register(spec.i18n);
            window.WIDGETS[spec.id] = {
                id: spec.id,
                title: spec.title,
                category: spec.category || "apetrov",
                description: spec.description || "",
                defaultSize: spec.defaultSize || { w: 6, h: 4 },
                apetrov: true,
                // mount() is async, but the WIDGETS contract expects a synchronous
                // {destroy, refresh} handle — return a facade that proxies to the
                // real instance once initialization resolves.
                mount(body, frame) {
                    const p = mount(spec, body, frame || {});
                    return {
                        destroy() { p.then(h => h && h.destroy()); },
                        refresh() { p.then(h => h && h.refresh()); },
                    };
                },
            };
        },
    };
})();
