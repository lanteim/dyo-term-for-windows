"use strict";
window.I18N.register({
    en: { "widget.extra_notify": "Reminders", "cat.productivity": "Productivity" },
    ru: { "widget.extra_notify": "Напоминания", "cat.productivity": "Продуктивность" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.extra_notify = {
    id: "extra_notify",
    title: "widget.extra_notify",
    category: "productivity",
    description: "Timed reminders that fire desktop notifications",
    defaultSize: { w: 7, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const SKEY = "extra_notify_items";
        let alive = true, items = [];

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                <input class="_msg" placeholder="Reminder text…" style="flex:1;min-width:120px"/>
                <input class="_at" type="datetime-local" style="width:190px"/>
                <button class="_add" style="border-color:var(--accent)">Add</button>
              </div>
              <div class="_perm" style="color:var(--text-dim);font-size:11px"></div>
              <div class="_list" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:4px"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        ["._msg", "._at"].forEach(s => { $(s).style.cssText += ";background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);box-sizing:border-box"; });
        $("._add").style.cssText += ";background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;cursor:pointer;font-family:var(--font-mono)";

        // default time = now + 5 min
        const d = new Date(Date.now() + 5 * 60000 - new Date().getTimezoneOffset() * 60000);
        $("._at").value = d.toISOString().slice(0, 16);

        const permInfo = () => {
            const p = (typeof Notification !== "undefined") ? Notification.permission : "unsupported";
            if (p === "granted") { $("._perm").textContent = "Desktop notifications enabled."; }
            else if (p === "unsupported") { $("._perm").textContent = "Notifications not supported here — reminders show inline."; }
            else { $("._perm").innerHTML = `Notifications ${esc(p)} — <span class="_req" style="color:var(--accent);cursor:pointer;text-decoration:underline">enable</span>`; const r = $("._req"); if (r) r.onclick = () => { Notification.requestPermission().then(() => permInfo()); }; }
        };

        const save = () => { const patch = {}; patch[SKEY] = items; window.dyo.settings.set(patch); };
        const load = async () => {
            const st = await window.dyo.settings.get();
            if (!alive) return;
            items = (st && Array.isArray(st[SKEY])) ? st[SKEY] : [];
            render();
        };

        const fire = it => {
            it.fired = true;
            try {
                if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                    new Notification("⏰ Reminder", { body: it.msg });
                }
            } catch (e) {}
            save(); render();
        };

        const render = () => {
            if (!alive) return;
            if (!items.length) { $("._list").innerHTML = `<div style="color:var(--text-dim);padding:6px">No reminders. Add one above.</div>`; return; }
            const now = Date.now();
            const sorted = items.slice().sort((a, b) => a.at - b.at);
            $("._list").innerHTML = "";
            sorted.forEach(it => {
                const due = it.at <= now;
                const when = new Date(it.at);
                const row = document.createElement("div");
                row.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-elevated)";
                if (it.fired) row.style.opacity = "0.55";
                else if (due) row.style.borderColor = "var(--danger)";
                const state = it.fired ? "fired" : (due ? "due" : "pending");
                const stColor = it.fired ? "var(--text-dim)" : (due ? "var(--danger)" : "var(--accent2)");
                row.innerHTML = `<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.msg)}</span>
                    <span style="color:var(--text-dim);font-size:11px;font-variant-numeric:tabular-nums">${when.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    <span style="color:${stColor};font-size:11px">${state}</span>`;
                const del = document.createElement("span");
                del.textContent = "✕"; del.title = "Remove";
                del.style.cssText = "cursor:pointer;color:var(--text-dim);padding:0 2px";
                del.onclick = () => { items = items.filter(x => x.id !== it.id); save(); render(); };
                row.appendChild(del);
                $("._list").appendChild(row);
            });
        };

        $("._add").onclick = () => {
            const msg = $("._msg").value.trim();
            const at = $("._at").value ? new Date($("._at").value).getTime() : NaN;
            if (!msg) { $("._perm").textContent = "Enter reminder text."; return; }
            if (isNaN(at)) { $("._perm").textContent = "Pick a valid time."; return; }
            items.push({ id: crypto.randomUUID(), msg, at, fired: false });
            $("._msg").value = "";
            if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission().then(permInfo);
            save(); render(); permInfo();
        };

        const tick = () => {
            if (!alive) return;
            const now = Date.now();
            let changed = false;
            items.forEach(it => { if (!it.fired && it.at <= now) { fire(it); changed = true; } });
            if (!changed) render();
        };

        permInfo();
        load();
        const iv = setInterval(tick, 3000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
