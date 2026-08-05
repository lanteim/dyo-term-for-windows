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
        num(n) { return (Number(n) || 0).toLocaleString(window.I18N.locale()); },
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

    // compact default annotation label (percent, bytes/s, counts…) — kept short
    // so right-edge / peak labels never overflow a narrow canvas.
    function gLabel(v) {
        v = Number(v);
        if (!isFinite(v)) return "";
        const a = Math.abs(v);
        if (a >= 1e9) return (v / 1e9).toFixed(1) + "G";
        if (a >= 1e6) return (v / 1e6).toFixed(1) + "M";
        if (a >= 1e3) return (v / 1e3).toFixed(1) + "k";
        return String(Math.round(v * 10) / 10);
    }
    function clockHMS(t) {
        const d = new Date(t), p = n => String(n).padStart(2, "0");
        return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
    }
    const GFONT = "9px ui-monospace, SFMono-Regular, Menlo, monospace";

    // ---- lightweight canvas line/area graph over a time series ----------------
    // Enriched, but signature-stable: existing callers (ap-cpu/mem/net/disk…) get
    // faint gridlines, a filled last-point dot, a right-edge value label, and a
    // dashed high-water "peak" line for free. opts.fmt(v)→string customizes the
    // labels; opts.hoverX (pixels) draws a crosshair + value@time tooltip.
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
        const css = getComputedStyle(document.documentElement);
        const accent = (opts.color || css.getPropertyValue("--accent") || "#38bdf8").trim();
        const accent2 = (css.getPropertyValue("--accent2") || accent).trim();
        const dim = (css.getPropertyValue("--text-dim") || "#8fa6c4").trim();
        const f = (typeof opts.fmt === "function") ? opts.fmt : gLabel;
        // resolve the value scale even with <2 samples so gridlines still render
        let min = opts.min, max = opts.max;
        if (min == null || max == null) {
            let lo = Infinity, hi = -Infinity;
            for (const p of (points || [])) { if (p.v < lo) lo = p.v; if (p.v > hi) hi = p.v; }
            if (!isFinite(lo)) { lo = 0; hi = 1; }
            if (min == null) min = 0;
            if (max == null) max = hi > 0 ? hi * 1.15 : 1;
        }
        if (max <= min) max = min + 1;
        const now = Date.now();
        const span = opts.rangeMs || ((points && points.length) ? (now - points[0].t) : 1) || 1;
        const t0 = now - span;
        const x = t => 2 + ((t - t0) / span) * (w - 4);
        const y = v => h - 2 - ((v - min) / (max - min)) * (h - 4);
        // ── faint horizontal gridlines (0/25/50/75/100 for a percent axis) ──
        const levels = (max === 100) ? [0, 25, 50, 75, 100] : [0, 1, 2, 3, 4].map(i => min + (max - min) * i / 4);
        g.lineWidth = 1;
        g.strokeStyle = hexA(dim, 0.12);
        g.beginPath();
        for (const lv of levels) { const yy = Math.round(y(lv)) + 0.5; g.moveTo(2, yy); g.lineTo(w - 2, yy); }
        g.stroke();
        if (!points || points.length < 2) {
            if (points && points.length === 1) drawLastDot(g, x, y, points[0], accent2, f, w, h);
            return;
        }
        // ── area fill ──
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
        // ── line ──
        g.beginPath();
        points.forEach((p, i) => { const px = x(p.t), py = y(p.v); i ? g.lineTo(px, py) : g.moveTo(px, py); });
        g.strokeStyle = accent2;
        g.lineWidth = 1.5;
        g.lineJoin = "round";
        g.stroke();
        // ── dashed high-water "peak" line at the series max within range ──
        let peak = -Infinity;
        for (const p of points) if (p.v > peak) peak = p.v;
        if (isFinite(peak) && peak > min) {
            const yy = Math.round(y(peak)) + 0.5;
            g.save();
            g.setLineDash([4, 3]); g.lineWidth = 1; g.strokeStyle = hexA(accent, 0.55);
            g.beginPath(); g.moveTo(2, yy); g.lineTo(w - 2, yy); g.stroke();
            g.restore();
            g.font = GFONT; g.textAlign = "left"; g.textBaseline = "bottom";
            g.fillStyle = hexA(accent, 0.8);
            g.fillText(window.I18N.t("apw.peak") + " " + f(peak), 4, Math.max(9, yy - 1));
        }
        // ── filled dot + right-edge value label at the last sample ──
        drawLastDot(g, x, y, points[points.length - 1], accent2, f, w, h);
        // ── hover crosshair + value@time tooltip ──
        if (opts.hoverX != null && isFinite(opts.hoverX)) {
            let best = null, bestD = Infinity;
            for (const p of points) { const d = Math.abs(x(p.t) - opts.hoverX); if (d < bestD) { bestD = d; best = p; } }
            if (best) {
                const hx = x(best.t);
                g.save();
                g.setLineDash([2, 2]); g.lineWidth = 1; g.strokeStyle = hexA(dim, 0.6);
                g.beginPath(); g.moveTo(Math.round(hx) + 0.5, 1); g.lineTo(Math.round(hx) + 0.5, h - 1); g.stroke();
                g.restore();
                g.beginPath(); g.arc(hx, y(best.v), 3, 0, Math.PI * 2); g.fillStyle = accent2; g.fill();
                const label = f(best.v) + "  " + clockHMS(best.t);
                g.font = GFONT;
                const tw = g.measureText(label).width + 10, bh = 14, by = 2;
                let bx = hx + 6; if (bx + tw > w - 2) bx = hx - 6 - tw; if (bx < 2) bx = 2;
                g.fillStyle = hexA(dim, 0.2); roundRect(g, bx, by, tw, bh, 3); g.fill();
                g.fillStyle = accent2; g.textAlign = "left"; g.textBaseline = "middle";
                g.fillText(label, bx + 5, by + bh / 2 + 0.5);
            }
        }
    }
    // filled last-point dot (with soft glow) + a right-edge value chip
    function drawLastDot(g, x, y, p, color, f, w, h) {
        const px = x(p.t), py = y(p.v);
        g.beginPath(); g.arc(px, py, 4.5, 0, Math.PI * 2); g.fillStyle = hexA(color, 0.18); g.fill();
        g.beginPath(); g.arc(px, py, 2.5, 0, Math.PI * 2); g.fillStyle = color; g.fill();
        const lab = f(p.v);
        if (lab === "") return;
        g.font = GFONT; g.textAlign = "right"; g.textBaseline = "middle";
        const tw = g.measureText(lab).width;
        const ly = Math.max(8, Math.min(h - 8, py));
        g.fillStyle = hexA(color, 0.16);
        roundRect(g, Math.max(2, w - 4 - tw - 6), ly - 7, tw + 6, 14, 3); g.fill();
        g.fillStyle = color;
        g.fillText(lab, w - 6, ly + 0.5);
    }
    function roundRect(g, x, y, w, h, r) {
        r = Math.max(0, Math.min(r, w / 2, h / 2));
        g.beginPath();
        g.moveTo(x + r, y);
        g.arcTo(x + w, y, x + w, y + h, r);
        g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r);
        g.arcTo(x, y, x + w, y, r);
        g.closePath();
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
            fails: 0,                       // consecutive update failures → adaptive backoff
            alerts: {}, breach: {}, lastFired: {}, // threshold state + notification bookkeeping
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
        // threshold breach chips (populated by ctx.alert; hidden when all-clear)
        const alertBar = document.createElement("div");
        alertBar.className = "apw-alertbar";
        body.appendChild(hostBadge);
        body.appendChild(alertBar);
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
                renderGraph(cv, key, opts || {});
            },
            // Threshold helper (opt-in). alert(key, value, {warn, crit, dir='up',
            // el|ref, label, forSec, cooldownSec, notifyOnWarn}) → 'ok'|'warn'|'crit'.
            // Colorizes the metric element, updates the widget chip/status, and
            // fires a desktop notification on a sustained breach.
            alert(key, value, opts) { return runAlert(key, value, opts || {}); },
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

        // ── graph interactivity: hover crosshair/tooltip + min/max/avg/last readout ──
        // Wired once per <canvas>; a readout line is inserted right after it. All
        // listeners + inserted nodes are dropped by teardownGraphs() on destroy and
        // before a degraded DOM rebuild, so nothing leaks across host switches.
        const graphMeta = new Map(); // canvas → { key, opts, hoverX, readout, onMove, onLeave, cv }
        function ensureGraph(cv) {
            let meta = graphMeta.get(cv);
            if (meta) return meta;
            meta = { key: null, opts: null, hoverX: null, cv, readout: null, onMove: null, onLeave: null };
            const ro = document.createElement("div");
            ro.className = "apw-readout";
            if (cv.parentNode) cv.parentNode.insertBefore(ro, cv.nextSibling);
            meta.readout = ro;
            meta.onMove = (e) => { const r = cv.getBoundingClientRect(); meta.hoverX = e.clientX - r.left; renderGraph(cv, meta.key, meta.opts || {}); };
            meta.onLeave = () => { meta.hoverX = null; renderGraph(cv, meta.key, meta.opts || {}); };
            cv.addEventListener("mousemove", meta.onMove);
            cv.addEventListener("mouseleave", meta.onLeave);
            graphMeta.set(cv, meta);
            return meta;
        }
        function renderGraph(cv, key, opts) {
            if (!cv) return;
            const meta = ensureGraph(cv);
            meta.key = key; meta.opts = opts;
            const points = ctx.series(key);
            drawGraph(cv, points, Object.assign({ rangeMs: st.range, hoverX: meta.hoverX }, opts || {}));
            updateReadout(meta.readout, points, opts);
        }
        function updateReadout(el, points, opts) {
            if (!el) return;
            if (!points || !points.length) { el.textContent = ""; return; }
            let lo = Infinity, hi = -Infinity, sum = 0;
            for (const p of points) { if (p.v < lo) lo = p.v; if (p.v > hi) hi = p.v; sum += p.v; }
            const last = points[points.length - 1].v, avg = sum / points.length;
            const f = (opts && typeof opts.fmt === "function") ? opts.fmt : gLabel;
            const T = window.I18N.t.bind(window.I18N);
            el.innerHTML =
                `<span><span class="lb">${T("apw.min")}</span> <b>${fmt.esc(f(lo))}</b></span>` +
                `<span><span class="lb">${T("apw.avg")}</span> <b>${fmt.esc(f(avg))}</b></span>` +
                `<span><span class="lb">${T("apw.max")}</span> <b>${fmt.esc(f(hi))}</b></span>` +
                `<span><span class="lb">${T("apw.last")}</span> <b>${fmt.esc(f(last))}</b></span>`;
        }
        function teardownGraphs() {
            graphMeta.forEach(m => {
                if (m.cv) { m.cv.removeEventListener("mousemove", m.onMove); m.cv.removeEventListener("mouseleave", m.onLeave); }
                if (m.readout && m.readout.remove) m.readout.remove();
            });
            graphMeta.clear();
        }

        // ── thresholds → colorize + chip/status + sustained-breach notification ──
        function runAlert(key, value, opts) {
            value = Number(value);
            const S = st.settings || {};
            let warn = opts.warn, crit = opts.crit;
            const ov = k => { const v = S[k]; return (v !== undefined && v !== null && v !== "") ? Number(v) : undefined; };
            if (ov("warn_" + key) !== undefined) warn = ov("warn_" + key); // widget opts in via settings schema
            if (ov("crit_" + key) !== undefined) crit = ov("crit_" + key);
            const dir = opts.dir || "up";
            let level = "ok";
            if (isFinite(value)) {
                if (dir === "down") {
                    if (crit != null && value <= crit) level = "crit";
                    else if (warn != null && value <= warn) level = "warn";
                } else {
                    if (crit != null && value >= crit) level = "crit";
                    else if (warn != null && value >= warn) level = "warn";
                }
            }
            let el = opts.el || null;
            if (!el && opts.ref) el = ctx.ref[opts.ref] || content.querySelector('[data-ref="' + opts.ref + '"]');
            if (el && el.classList) { el.classList.remove("apw-ok", "apw-warn", "apw-crit"); el.classList.add("apw-" + level); }
            if (level === "ok") delete st.alerts[key];
            else st.alerts[key] = { level, value, label: opts.label || key };
            renderAlertBar();
            maybeNotify(key, level, value, opts);
            return level;
        }
        function renderAlertBar() {
            const keys = Object.keys(st.alerts);
            if (!keys.length) { alertBar.className = "apw-alertbar"; alertBar.innerHTML = ""; if (frame && frame.setAlert) frame.setAlert("ok"); return; }
            let worst = "warn";
            keys.forEach(k => { if (st.alerts[k].level === "crit") worst = "crit"; });
            alertBar.className = "apw-alertbar on";
            alertBar.innerHTML = keys.map(k => { const a = st.alerts[k]; const cls = a.level === "crit" ? "err" : "warn"; return `<span class="apw-chip ${cls}">${fmt.esc(a.label)} ${fmt.esc(gLabel(a.value))}</span>`; }).join("");
            if (frame && frame.setAlert) frame.setAlert(worst);
        }
        function maybeNotify(key, level, value, opts) {
            const now = Date.now();
            const breached = level === "crit" || (opts.notifyOnWarn && level === "warn");
            if (!breached) { delete st.breach[key]; return; }
            const b = st.breach[key] || (st.breach[key] = { since: now });
            const forSec = Number(opts.forSec != null ? opts.forSec : st.settings.alert_for_sec);
            const forMs = (isFinite(forSec) && forSec > 0 ? forSec : 30) * 1000;
            const coolSec = Number(opts.cooldownSec != null ? opts.cooldownSec : st.settings.alert_cooldown_sec);
            const coolMs = (isFinite(coolSec) && coolSec > 0 ? coolSec : 300) * 1000;
            if (now - b.since < forMs) return;                                  // not sustained yet
            if (st.lastFired[key] && now - st.lastFired[key] < coolMs) return;  // still cooling down
            st.lastFired[key] = now;
            fireNotification(key, level, value, opts);
        }
        function fireNotification(key, level, value, opts) {
            try {
                if (typeof Notification === "undefined") return; // no bridge/API — skip gracefully
                const host = window.__monitorHost;
                const where = (host && host.label) ? host.label : window.I18N.t("apw.local");
                const title = window.I18N.t(spec.title) + (host && host.label ? " · " + host.label : "");
                const body = (opts.label || key) + ": " + gLabel(value) + " " + (level === "crit" ? "≥ crit" : "≥ warn") + " — " + where;
                const fire = () => { try { new Notification(title, { body, tag: "apw-" + id + "-" + key }); } catch (e) {} };
                if (Notification.permission === "granted") fire();
                else if (Notification.permission === "default" && !st.notifyAsked) { st.notifyAsked = true; Notification.requestPermission().then(p => { if (p === "granted") fire(); }).catch(() => {}); }
            } catch (e) { /* notifications unavailable — non-fatal */ }
        }

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
            if (!manual && (!st.visible || collapsed())) { armTick(); return; } // idle when hidden → low CPU, but keep polling so expand/scroll-in resumes
            inFlight = true;
            if (frame && frame.setBusy) frame.setBusy(true);
            const e0 = epoch;
            try {
                // A prior notAvailable() wiped the widget's DOM — rebuild it so a
                // recovered update (e.g. after switching to an SSH host that works)
                // writes into live, re-bound nodes instead of detached ones.
                if (st.degraded) { teardownGraphs(); try { spec.render(ctx); ctx.bindRefs(); } catch (e) {} st.degraded = false; }
                st.tick = Date.now(); // one timestamp per update cycle — keeps CSV rows aligned
                await spec.update(ctx);
                if (e0 !== epoch) { st.hist = {}; ctx._r = {}; return; } // stale: host changed mid-flight — drop its samples
                st.lastUpdated = Date.now();
                st.fails = 0; // healthy → resume the normal interval next tick
                if (frame && frame.setUpdated) frame.setUpdated(st.lastUpdated, interval);
                if (runtimeErr) { runtimeErr = false; if (status.classList.contains("err")) ctx.setStatus(""); }
                redrawGraphs();
            } catch (e) {
                if (e0 === epoch) { runtimeErr = true; st.fails++; ctx.setStatus(String((e && e.message) || e), "err"); }
            } finally {
                st.tick = 0;
                inFlight = false;
                if (frame && frame.setBusy) frame.setBusy(false);
                if (pendingRefresh) { pendingRefresh = false; runUpdate(true); }
                else if (st.alive) armTick(); // self-reschedule (interval, or exp backoff while failing)
            }
        }
        function collapsed() { return !!(body.closest(".grid-stack-item") || body).classList && (body.closest(".grid-stack-item") || {}).classList && body.closest(".grid-stack-item").classList.contains("apw-collapsed"); }

        // pause work when scrolled out of view
        let io = null;
        try {
            io = new IntersectionObserver(es => { st.visible = es.some(e => e.isIntersecting); if (st.visible) runUpdate(false); }, { threshold: 0.01 });
            io.observe(body);
        } catch (e) { st.visible = true; }

        // Redraw graphs when the widget box changes size (adaptive column reflow,
        // divider drag, density change) so canvases refill immediately rather than
        // waiting for the next refresh tick. rAF-coalesced to stay cheap.
        let ro = null, roRAF = 0;
        try {
            ro = new ResizeObserver(() => { if (roRAF) return; roRAF = requestAnimationFrame(() => { roRAF = 0; if (st.visible) redrawGraphs(); }); });
            ro.observe(body);
        } catch (e) { /* ResizeObserver unavailable — tick redraw still covers it */ }

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
                if (ni !== interval) { interval = ni; st.fails = 0; armTick(); }
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
            st.fails = 0;                                   // new host — reset backoff
            st.alerts = {}; st.breach = {}; st.lastFired = {}; // and any prior host's threshold state
            renderAlertBar();
            renderHost();
            if (inFlight) pendingRefresh = true; else runUpdate(true);
        };
        window.addEventListener("dyo-host-change", onHostChange);

        // Single self-rescheduling timer (replaces the old fixed setInterval): the
        // healthy cadence is `interval`; on failure runUpdate() bumps st.fails and
        // the next delay grows exponentially, capped at 30s (Grafana/Netdata-style
        // backoff). A success resets st.fails and returns to the normal interval.
        let tickTimer = null;
        function armTick() {
            if (!st.alive) return;
            clearTimeout(tickTimer);
            const delay = st.fails > 0 ? Math.min(interval * Math.pow(2, st.fails), 30000) : interval;
            tickTimer = setTimeout(() => runUpdate(false), delay);
        }

        runUpdate(true);  // first paint (also arms the loop from its finally)
        armTick();        // …and arm explicitly in case that first run was gated out

        return {
            destroy() {
                st.alive = false;
                clearTimeout(tickTimer);
                teardownGraphs();
                if (io) io.disconnect();
                if (ro) ro.disconnect();
                if (roRAF) cancelAnimationFrame(roRAF);
                window.removeEventListener("dyo-host-change", onHostChange);
                if (settingsOv) { settingsOv.remove(); settingsOv = null; }
                if (frame && frame.setAlert) frame.setAlert("ok");
                if (frame && frame.setStale) frame.setStale(false);
            },
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

    // ── self-contained polish CSS (id-guarded, injected once) ──────────────────
    // Everything the runtime adds lives here so app.css needs no edits: taller
    // graphs, the under-graph readout, threshold chips/colorization, the header
    // alert dot, and the STALE marker.
    (function injectPolish() {
        if (document.getElementById("apw-polish-css")) return;
        const s = document.createElement("style");
        s.id = "apw-polish-css";
        s.textContent = `
.apw-content canvas.apw-graph { height: clamp(48px, 28cqh, 260px); cursor: crosshair; }
.apw-content canvas.apw-graph.apw-grow { height: clamp(90px, 60cqh, 560px); }
.apw-readout { display:flex; gap:10px; flex-wrap:wrap; font-size:9.5px; color:var(--text-dim); margin-top:3px; font-variant-numeric:tabular-nums; letter-spacing:.3px; }
.apw-readout b { color:var(--text); font-weight:600; }
.apw-readout .lb { color:color-mix(in srgb, var(--accent2) 75%, var(--text-dim)); text-transform:uppercase; }
.apw-alertbar { display:none; gap:6px; flex-wrap:wrap; margin-bottom:6px; flex:0 0 auto; }
.apw-alertbar.on { display:flex; }
.apw-ok   { color:var(--ok, #34d399) !important; }
.apw-warn { color:var(--warn, #fbbf24) !important; }
.apw-crit { color:var(--danger) !important; }
.w-alert { display:none; width:8px; height:8px; border-radius:50%; margin:0 4px; box-shadow:0 0 6px currentColor; vertical-align:middle; }
.w-alert.on { display:inline-block; }
.w-alert.warn { color:var(--warn,#fbbf24); background:var(--warn,#fbbf24); }
.w-alert.crit { color:var(--danger); background:var(--danger); }
.w-stale { display:none; margin-left:6px; color:var(--warn,#fbbf24); font-size:9px; font-weight:700; letter-spacing:.5px; }
.widget.stale .w-stale { display:inline; }
.widget.stale > .body { opacity:.55; filter:grayscale(.2); transition:opacity .25s ease; }
`;
        (document.head || document.documentElement).appendChild(s);
    })();

    if (window.I18N && window.I18N.register) window.I18N.register({
        en: { "apw.min": "min", "apw.avg": "avg", "apw.max": "max", "apw.last": "last", "apw.peak": "peak", "apw.stale": "STALE", "apw.local": "local" },
        ru: { "apw.min": "мин", "apw.avg": "сред", "apw.max": "макс", "apw.last": "посл", "apw.peak": "пик", "apw.stale": "УСТАР", "apw.local": "локально" },
    });
})();
