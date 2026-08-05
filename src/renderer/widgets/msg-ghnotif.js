"use strict";
window.I18N.register({
    en: { "widget.msg_ghnotif": "GitHub Notifications", "cat.messaging": "Messaging" },
    ru: { "widget.msg_ghnotif": "Уведомления GitHub", "cat.messaging": "Сообщения" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.msg_ghnotif = {
    id: "msg_ghnotif",
    title: "widget.msg_ghnotif",
    category: "messaging",
    description: "Unread GitHub notifications via gh CLI",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div style="display:flex;align-items:baseline;gap:8px">
                <span style="font-size:24px;font-weight:600;color:var(--accent2);font-variant-numeric:tabular-nums" id="_gn_count">—</span>
                <span style="color:var(--text-dim)">unread</span>
              </div>
              <div id="_gn_list" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:2px;min-height:0"></div>
              <div style="display:flex;align-items:center;gap:8px">
                <button id="_gn_go" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px">Refresh</button>
                <span id="_gn_meta" style="color:var(--text-dim);font-size:11px"></span>
              </div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const cwd = () => (window.term ? window.term.lastCwd : undefined);

        const tick = async () => {
            if (!alive || busy) return;
            busy = true; $("#_gn_meta").textContent = "polling…";
            try {
                const r = await window.dyo.exec("gh", ["api", "notifications", "--paginate", "-q", ".[] | {reason,title:.subject.title,type:.subject.type,repo:.repository.full_name}"], { cwd: cwd(), timeout: 12000 });
                if (!alive) return;
                if (!r || (r.code !== 0 && !r.stdout)) {
                    const err = (r && (r.stderr || r.error)) || "gh CLI not available";
                    $("#_gn_count").textContent = "—";
                    $("#_gn_list").innerHTML = `<span style="color:var(--danger)">${esc(String(err).split("\n")[0])}</span><div style="color:var(--text-dim);margin-top:4px">Install gh & run: gh auth login</div>`;
                    $("#_gn_meta").textContent = "unavailable";
                    return;
                }
                const lines = String(r.stdout || "").split("\n").map(l => l.trim()).filter(Boolean);
                const items = [];
                lines.forEach(l => { try { items.push(JSON.parse(l)); } catch (e) {} });
                $("#_gn_count").textContent = String(items.length);
                $("#_gn_count").style.color = items.length ? "var(--accent2)" : "var(--text-dim)";
                const list = $("#_gn_list"); list.innerHTML = "";
                items.slice(0, 100).forEach(it => {
                    const div = document.createElement("div");
                    div.style.cssText = "white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
                    div.textContent = "• [" + (it.reason || "?") + "] " + (it.title || "") + (it.repo ? "  " + it.repo : "");
                    div.title = div.textContent;
                    list.appendChild(div);
                });
                if (!items.length) list.innerHTML = `<span style="color:var(--accent2)">inbox zero 🎉</span>`;
                $("#_gn_meta").textContent = "updated " + new Date().toLocaleTimeString(window.I18N.locale());
            } catch (e) {
                if (alive) $("#_gn_list").innerHTML = `<span style="color:var(--danger)">${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };

        $("#_gn_go").onclick = tick;
        tick();
        const iv = setInterval(tick, 60000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
