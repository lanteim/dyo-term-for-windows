"use strict";
window.I18N.register({
    en: { "widget.envview": "Environment", "cat.terminal": "Terminal" },
    ru: { "widget.envview": "Переменные окружения", "cat.terminal": "Терминал" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.envview = {
    id: "envview",
    title: "widget.envview",
    category: "terminal",
    description: "Searchable environment variables (secrets masked)",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const SECRET = /KEY|TOKEN|SECRET|PASS/i;
        let alive = true;
        let vars = [];

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px">
                <input id="_ev_q" placeholder="Filter variables…" style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-elevated);color:var(--text);font-family:var(--font-ui);font-size:12px">
                <div id="_ev_list" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:2px"></div>
            </div>`;
        const q = body.querySelector("#_ev_q");
        const list = body.querySelector("#_ev_list");

        function msg(text) {
            list.innerHTML = `<div style="color:var(--text-dim);font-size:12px;padding:6px">${esc(text)}</div>`;
        }

        function render() {
            const filter = q.value.trim().toLowerCase();
            const rows = filter ? vars.filter(v => (v.k + "=" + v.v).toLowerCase().includes(filter)) : vars;
            if (!rows.length) { msg(filter ? "No matches." : "No variables."); return; }
            list.innerHTML = "";
            rows.slice(0, 400).forEach(v => {
                const masked = SECRET.test(v.k);
                const shown = masked ? "••••••••" : v.v;
                const row = document.createElement("div");
                row.style.cssText = "font-family:var(--font-mono);font-size:11px;padding:3px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-elevated);white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
                row.title = masked ? v.k + " (hidden)" : v.k + "=" + v.v;
                row.innerHTML = `<span style="color:var(--accent)">${esc(v.k)}</span><span style="color:var(--text-dim)">=</span><span style="color:${masked ? "var(--danger)" : "var(--text)"}">${esc(shown)}</span>`;
                list.appendChild(row);
            });
        }

        async function load() {
            msg("Reading environment…");
            let r;
            try { r = await window.dyo.exec("printenv", [], { timeout: 8000 }); }
            catch (e) { if (alive) msg("printenv failed."); return; }
            if (!alive) return;
            if (!r || r.code !== 0 || !r.stdout || !r.stdout.trim()) { msg("printenv not available."); return; }
            const out = [];
            for (const line of r.stdout.split("\n")) {
                if (!line) continue;
                const idx = line.indexOf("=");
                if (idx < 0) {
                    // continuation of a multi-line value; append to previous
                    if (out.length) out[out.length - 1].v += "\n" + line;
                    continue;
                }
                out.push({ k: line.slice(0, idx), v: line.slice(idx + 1) });
            }
            out.sort((a, b) => a.k.localeCompare(b.k));
            vars = out;
            render();
        }

        q.addEventListener("input", render);
        load();
        return { destroy: () => { alive = false; } };
    }
};
