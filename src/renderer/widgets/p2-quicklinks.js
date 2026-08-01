"use strict";
window.I18N.register({
    en: { "widget.p2_quicklinks": "Quick Links", "cat.productivity": "Productivity" },
    ru: { "widget.p2_quicklinks": "Быстрые ссылки", "cat.productivity": "Продуктивность" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.p2_quicklinks = {
    id: "p2_quicklinks",
    title: "widget.p2_quicklinks",
    category: "productivity",
    description: "Saved list of links opened in the default browser",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const normUrl = u => {
            u = String(u || "").trim();
            if (!u) return "";
            if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(u) && !/^mailto:/i.test(u)) u = "https://" + u;
            return u;
        };
        let alive = true;
        let links = []; // {label, url}

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px">
                <div style="display:flex;gap:6px">
                    <input id="_ql_label" type="text" placeholder="Label"
                        style="flex:1;min-width:0;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:5px 8px;font-size:12px">
                    <input id="_ql_url" type="text" placeholder="example.com"
                        style="flex:1.4;min-width:0;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:5px 8px;font-size:12px">
                    <button id="_ql_add" style="background:var(--accent);border:none;color:#fff;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:12px">Add</button>
                </div>
                <div id="_ql_list" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:3px"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        const labelIn = $("#_ql_label"), urlIn = $("#_ql_url"), listEl = $("#_ql_list");

        const save = () => window.dyo.settings.set({ "p2.quicklinks": links });

        const render = () => {
            listEl.innerHTML = "";
            if (!links.length) {
                listEl.innerHTML = `<div style="color:var(--text-dim);font-size:12px;padding:4px 2px">No links yet. Add one above.</div>`;
                return;
            }
            links.slice(0, 200).forEach((lk, idx) => {
                const row = document.createElement("div");
                row.style.cssText = "display:flex;align-items:center;gap:8px;padding:5px 6px;border:1px solid var(--border);border-radius:6px;background:var(--bg-elevated)";
                const open = document.createElement("button");
                open.style.cssText = "flex:1;min-width:0;text-align:left;background:none;border:none;cursor:pointer;padding:0;color:var(--accent);font-size:12px";
                open.title = lk.url;
                open.innerHTML = `<span style="color:var(--text);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(lk.label || lk.url)}</span><span style="color:var(--text-dim);font-size:10px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(lk.url)}</span>`;
                open.onclick = () => { if (window.dyo.openExternal) window.dyo.openExternal(lk.url); };
                const del = document.createElement("button");
                del.textContent = "×"; del.title = "Remove";
                del.style.cssText = "background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:16px;line-height:1;padding:0 4px";
                del.onclick = () => { links.splice(idx, 1); save(); render(); };
                row.appendChild(open); row.appendChild(del);
                listEl.appendChild(row);
            });
        };

        const add = () => {
            const url = normUrl(urlIn.value);
            if (!url) return;
            const label = labelIn.value.trim() || url;
            links.push({ label, url });
            labelIn.value = ""; urlIn.value = "";
            save(); render();
        };
        $("#_ql_add").onclick = add;
        urlIn.addEventListener("keydown", e => { if (e.key === "Enter") add(); });
        labelIn.addEventListener("keydown", e => { if (e.key === "Enter") urlIn.focus(); });

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            const stored = s && s["p2.quicklinks"];
            links = Array.isArray(stored)
                ? stored.filter(x => x && typeof x.url === "string").map(x => ({ label: String(x.label || ""), url: String(x.url) }))
                : [];
            render();
        }).catch(() => { if (alive) render(); });

        return { destroy: () => { alive = false; } };
    }
};
