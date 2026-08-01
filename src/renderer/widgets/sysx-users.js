"use strict";
window.I18N.register({
    en: { "widget.sysx_users": "Logged-in Users", "cat.system": "System" },
    ru: { "widget.sysx_users": "Пользователи", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.sysx_users = {
        id: "sysx_users",
        title: "widget.sysx_users",
        category: "system",
        description: "currently logged-in users (who)",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">👤 WHO</span>
                    <span id="_sxu_msg" style="color:var(--text-dim);margin-left:auto"></span>
                  </div>
                  <div id="_sxu_body" style="flex:1;overflow:auto;font-family:var(--font-mono);font-size:11px"></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const res = await window.dyo.exec("who", [], { timeout: 6000 });
                    if (!res || (res.code !== 0 && !res.stdout)) {
                        $("#_sxu_msg").textContent = "unavailable";
                        $("#_sxu_body").innerHTML = `<div style="color:var(--text-dim)">who not available</div>`;
                        return;
                    }
                    const lines = (res.stdout || "").split("\n").filter(l => l.trim());
                    if (!lines.length) { $("#_sxu_msg").textContent = ""; $("#_sxu_body").innerHTML = `<div style="color:var(--text-dim)">no sessions</div>`; return; }
                    const sessions = lines.map(l => {
                        const p = l.trim().split(/\s+/);
                        const user = p[0] || "";
                        const tty = p[1] || "";
                        const rest = p.slice(2).join(" ");
                        return { user, tty, rest };
                    });
                    const uniqUsers = new Set(sessions.map(s => s.user));
                    $("#_sxu_msg").textContent = uniqUsers.size + " user" + (uniqUsers.size === 1 ? "" : "s") + " · " + sessions.length + " session" + (sessions.length === 1 ? "" : "s");
                    let html = `<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="text-align:left;color:var(--text-dim)"><th style="padding:2px 6px">user</th><th style="padding:2px 6px">tty</th><th style="padding:2px 6px">since</th></tr></thead><tbody>`;
                    sessions.slice(0, 40).forEach(s => {
                        html += `<tr style="border-top:1px solid var(--border)">`
                            + `<td style="padding:2px 6px;color:var(--accent)">${esc(s.user)}</td>`
                            + `<td style="padding:2px 6px;color:var(--text)">${esc(s.tty)}</td>`
                            + `<td style="padding:2px 6px;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.rest)}</td></tr>`;
                    });
                    html += `</tbody></table>`;
                    $("#_sxu_body").innerHTML = html;
                } catch (e) {
                    $("#_sxu_msg").textContent = "error";
                } finally { busy = false; }
            };
            tick();
            const iv = setInterval(tick, 8000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
