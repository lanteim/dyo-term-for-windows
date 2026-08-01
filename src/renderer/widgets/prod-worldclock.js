"use strict";
window.I18N.register({
    en: { "widget.prod-worldclock": "World Clock", "cat.productivity": "Productivity" },
    ru: { "widget.prod-worldclock": "Мировые часы", "cat.productivity": "Продуктивность" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS["prod-worldclock"] = {
    id: "prod-worldclock",
    title: "widget.prod-worldclock",
    category: "productivity",
    description: "Configurable list of timezone clocks",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const DEFAULTS = ["UTC", "America/New_York", "Europe/London", "Asia/Tokyo"];
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px">
                <div id="_wc_list" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:3px"></div>
                <button id="_wc_add" style="background:var(--bg-elevated);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px">+ Add timezone</button>
            </div>`;
        const $ = s => body.querySelector(s);
        const listEl = $("#_wc_list");
        let zones = DEFAULTS.slice();
        let alive = true;

        const save = () => { window.dyo.settings.set({ "prod.zones": zones }); };

        const tzValid = tz => {
            try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; }
            catch (e) { return false; }
        };

        const build = () => {
            listEl.innerHTML = "";
            if (!zones.length) {
                listEl.innerHTML = `<div style="color:var(--text-dim);font-size:12px;padding:4px 2px">No timezones. Add one below.</div>`;
                return;
            }
            zones.forEach((tz, idx) => {
                const row = document.createElement("div");
                row.className = "metric-row";
                row.style.cssText = "display:flex;align-items:center;gap:8px";
                const k = document.createElement("span");
                k.className = "k";
                k.textContent = tz.split("/").pop().replace(/_/g, " ");
                k.title = tz;
                k.style.cssText = "flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
                const v = document.createElement("span");
                v.className = "v";
                v.dataset.tz = tz;
                v.style.cssText = "font-variant-numeric:tabular-nums;font-family:var(--font-mono)";
                const del = document.createElement("button");
                del.textContent = "×";
                del.title = "Remove";
                del.style.cssText = "background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:15px;line-height:1;padding:0 2px";
                del.onclick = () => { zones.splice(idx, 1); save(); build(); tick(); };
                row.appendChild(k); row.appendChild(v); row.appendChild(del);
                listEl.appendChild(row);
            });
        };

        const tick = () => {
            if (!alive) return;
            const now = new Date();
            listEl.querySelectorAll("span.v[data-tz]").forEach(el => {
                const tz = el.dataset.tz;
                try {
                    el.textContent = new Intl.DateTimeFormat([], {
                        timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
                    }).format(now);
                } catch (e) {
                    el.textContent = "invalid tz";
                }
            });
        };

        $("#_wc_add").onclick = () => {
            const tz = prompt("IANA timezone (e.g. Europe/Berlin):");
            if (tz == null) return;
            const t = tz.trim();
            if (!t) return;
            if (!tzValid(t)) { alert("Unknown timezone: " + t); return; }
            zones.push(t); save(); build(); tick();
        };

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            const stored = s && s["prod.zones"];
            zones = Array.isArray(stored) && stored.length ? stored.filter(z => typeof z === "string") : DEFAULTS.slice();
            build(); tick();
        }).catch(() => { if (alive) { build(); tick(); } });

        const iv = setInterval(tick, 1000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
