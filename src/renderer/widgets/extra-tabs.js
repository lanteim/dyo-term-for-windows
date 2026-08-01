"use strict";
window.I18N.register({
    en: { "widget.extra_tabs": "Tabs Overview", "cat.productivity": "Productivity" },
    ru: { "widget.extra_tabs": "Обзор вкладок", "cat.productivity": "Продуктивность" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.extra_tabs = {
    id: "extra_tabs",
    title: "widget.extra_tabs",
    category: "productivity",
    description: "List terminal tabs; click to focus",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        let alive = true;

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div style="display:flex;align-items:center;gap:6px">
                <span style="color:var(--text-dim)">Open tabs</span>
                <span class="_cnt" style="color:var(--accent2)"></span>
              </div>
              <div class="_list" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:4px"></div>
            </div>`;
        const $ = s => body.querySelector(s);

        const render = () => {
            if (!alive) return;
            const term = window.term;
            const tabs = (term && term.tabs) || [];
            const active = term ? term.active : -1;
            const cwd = (term && term.lastCwd) || "~";
            $("._cnt").textContent = tabs.length ? tabs.length + " tab" + (tabs.length > 1 ? "s" : "") : "";
            if (!tabs.length) { $("._list").innerHTML = `<div style="color:var(--text-dim);padding:6px">No tabs found.</div>`; return; }
            $("._list").innerHTML = "";
            tabs.forEach((tab, i) => {
                const isActive = i === active;
                const paneCount = (tab && typeof tab.panes === "function") ? (tab.panes() || []).length : 1;
                const row = document.createElement("div");
                row.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;cursor:pointer;background:var(--bg-elevated)";
                if (isActive) row.style.borderColor = "var(--accent)";
                row.innerHTML = `<span style="width:18px;height:18px;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;background:${isActive ? "var(--accent)" : "var(--border)"};color:var(--bg-elevated);font-weight:600;font-size:11px">${i + 1}</span>
                    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${isActive ? esc(cwd) : "shell"}</span>
                    <span style="color:var(--text-dim);font-size:11px">${paneCount} pane${paneCount > 1 ? "s" : ""}</span>
                    ${isActive ? `<span style="color:var(--accent2);font-size:11px">active</span>` : ""}`;
                row.onclick = () => { try { window.term.focusTab(i); } catch (e) {} setTimeout(render, 60); };
                $("._list").appendChild(row);
            });
        };
        render();
        const iv = setInterval(render, 2000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
