"use strict";
// Command palette — a fuzzy launcher over every app action. The action list is
// published by core/app.js on window.__actions ([{ id, label, keys, run, cat }]);
// this file only renders/filters/invokes them. Reuses the .overlay/.dialog shell.
(function () {
    let overlay = null, input = null, list = null, sel = 0, filtered = [];

    function esc(s) {
        return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
    }
    function t(k) { return window.I18N ? window.I18N.t(k) : k; }

    // Subsequence fuzzy match: every query char must appear in order. Returns a
    // score (higher = better: prefix + contiguous runs win) or -1 for no match.
    function score(q, text) {
        if (!q) return 1;
        q = q.toLowerCase();
        const s = text.toLowerCase();
        if (s.includes(q)) return 1000 - s.indexOf(q);   // substring beats scatter
        let qi = 0, sc = 0, run = 0;
        for (let i = 0; i < s.length && qi < q.length; i++) {
            if (s[i] === q[qi]) { qi++; run++; sc += 1 + run; }
            else run = 0;
        }
        return qi === q.length ? sc : -1;
    }

    function render() {
        const q = input.value.trim();
        const actions = (window.__actions || []).filter(a => a && typeof a.run === "function");
        filtered = actions
            .map(a => ({ a, s: score(q, t(a.label)) }))
            .filter(x => x.s >= 0)
            .sort((x, y) => y.s - x.s)
            .map(x => x.a);
        if (sel >= filtered.length) sel = Math.max(0, filtered.length - 1);
        list.innerHTML = "";
        if (!filtered.length) {
            list.innerHTML = `<div class="palette-empty">${esc(t("palette.none"))}</div>`;
            return;
        }
        filtered.forEach((a, i) => {
            const row = document.createElement("div");
            row.className = "palette-row" + (i === sel ? " sel" : "");
            row.innerHTML = `<span class="p-label">${esc(t(a.label))}</span><span class="p-keys">${esc(a.keys || "")}</span>`;
            row.addEventListener("mouseenter", () => { sel = i; mark(); });
            row.addEventListener("click", () => run(a));
            list.appendChild(row);
        });
    }

    function mark() {
        const rows = list.querySelectorAll(".palette-row");
        rows.forEach((r, i) => r.classList.toggle("sel", i === sel));
        const el = rows[sel];
        if (el) el.scrollIntoView({ block: "nearest" });
    }

    function run(a) { close(); try { a.run(); } catch (e) { console.error("palette action failed", e); } }

    function open() {
        if (overlay) { close(); return; }
        sel = 0;
        overlay = document.createElement("div");
        overlay.className = "overlay palette-overlay open";
        overlay.innerHTML = `
            <div class="dialog palette-dialog">
                <input class="palette-input" placeholder="${esc(t("palette.placeholder"))}" spellcheck="false"/>
                <div class="palette-list"></div>
            </div>`;
        document.body.appendChild(overlay);
        input = overlay.querySelector(".palette-input");
        list = overlay.querySelector(".palette-list");
        input.addEventListener("keydown", e => {
            e.stopPropagation();
            if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(filtered.length - 1, sel + 1); mark(); }
            else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
            else if (e.key === "Enter") { e.preventDefault(); if (filtered[sel]) run(filtered[sel]); }
            else if (e.key === "Escape") { e.preventDefault(); close(); }
        });
        input.addEventListener("input", () => { sel = 0; render(); });
        overlay.addEventListener("mousedown", e => { if (e.target === overlay) close(); });
        render();
        input.focus();
    }

    function close() {
        if (overlay) { overlay.remove(); overlay = null; input = null; list = null; }
    }

    window.Palette = { open, close, isOpen: () => !!overlay };
})();
