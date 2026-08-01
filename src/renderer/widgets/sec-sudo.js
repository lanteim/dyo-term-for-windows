"use strict";
window.I18N.register({
    en: { "widget.sec_sudo": "Sessions & Logins", "cat.security": "Security" },
    ru: { "widget.sec_sudo": "Сессии и входы", "cat.security": "Безопасность" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.sec_sudo = {
    id: "sec_sudo",
    title: "widget.sec_sudo",
    category: "security",
    description: "Active login sessions (who) and recent logins (last)",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
              <div>
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="color:var(--accent)">Active sessions</span>
                  <span class="_su_wmeta" style="color:var(--text-dim);margin-left:auto">…</span>
                </div>
                <div class="_su_who" style="margin-top:4px;font-family:var(--font-mono);font-size:11px"></div>
              </div>
              <div style="flex:1;display:flex;flex-direction:column;min-height:0">
                <div style="color:var(--accent)">Recent logins</div>
                <div class="_su_last" style="margin-top:4px;flex:1;overflow:auto;font-family:var(--font-mono);font-size:11px"></div>
              </div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const [who, last] = await Promise.all([
                    window.dyo.exec("who", [], { timeout: 6000 }),
                    window.dyo.exec("last", ["-5"], { timeout: 6000 })
                ]);
                if (!alive) return;

                const whoLines = (who && who.stdout || "").split("\n").filter(l => l.trim());
                if (!who || (who.code !== 0 && !whoLines.length)) {
                    $("._su_who").innerHTML = `<span style="color:var(--danger)">who unavailable</span>`;
                    $("._su_wmeta").textContent = "";
                } else {
                    $("._su_wmeta").textContent = `${whoLines.length} session${whoLines.length === 1 ? "" : "s"}`;
                    if (!whoLines.length) $("._su_who").innerHTML = `<span style="color:var(--text-dim)">none</span>`;
                    else $("._su_who").innerHTML = whoLines.slice(0, 20).map(l => {
                        const p = l.trim().split(/\s+/);
                        const user = p[0] || "", tty = p[1] || "";
                        const rest = p.slice(2).join(" ");
                        return `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><b style="color:var(--accent2)">${esc(user)}</b> <span style="color:var(--text-dim)">${esc(tty)}</span> ${esc(rest)}</div>`;
                    }).join("");
                }

                const lastLines = (last && last.stdout || "").split("\n").filter(l => l.trim() && !/^wtmp begins/i.test(l));
                if (!last || (last.code !== 0 && !lastLines.length)) {
                    $("._su_last").innerHTML = `<span style="color:var(--danger)">last unavailable</span>`;
                } else if (!lastLines.length) {
                    $("._su_last").innerHTML = `<span style="color:var(--text-dim)">no recent logins</span>`;
                } else {
                    $("._su_last").innerHTML = lastLines.slice(0, 20).map(l => {
                        const still = /still logged in|still online/i.test(l);
                        return `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${still ? "var(--accent)" : "var(--text-dim)"}">${esc(l)}</div>`;
                    }).join("");
                }
            } catch (e) {
                if (alive) $("._su_last").innerHTML = `<span style="color:var(--danger)">Error: ${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 15000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
