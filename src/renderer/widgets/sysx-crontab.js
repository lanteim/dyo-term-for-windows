"use strict";
window.I18N.register({
    en: { "widget.sysx_crontab": "Crontab Jobs", "cat.system": "System" },
    ru: { "widget.sysx_crontab": "Задания Cron", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.sysx_crontab = {
        id: "sysx_crontab",
        title: "widget.sysx_crontab",
        category: "system",
        description: "current user crontab jobs",
        defaultSize: { w: 6, h: 4 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🗓️ CRONTAB -l</span>
                    <span id="_sxc_msg" style="color:var(--text-dim);margin-left:auto"></span>
                  </div>
                  <div id="_sxc_body" style="flex:1;overflow:auto;font-family:var(--font-mono);font-size:11px"></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const res = await window.dyo.exec("crontab", ["-l"], { timeout: 8000 });
                    if (!res) { $("#_sxc_msg").textContent = "unavailable"; return; }
                    const err = (res.stderr || "").toLowerCase();
                    if (res.code !== 0) {
                        // "no crontab for user" is a normal, friendly state
                        const friendly = err.includes("no crontab") ? "no crontab for this user" : (res.code === 127 ? "crontab not found" : "unavailable");
                        $("#_sxc_msg").textContent = "";
                        $("#_sxc_body").innerHTML = `<div style="color:var(--text-dim);padding:8px 0">${esc(friendly)}</div>`;
                        return;
                    }
                    const lines = (res.stdout || "").split("\n").filter(l => l.trim() && !l.trim().startsWith("#"));
                    if (!lines.length) {
                        $("#_sxc_msg").textContent = "";
                        $("#_sxc_body").innerHTML = `<div style="color:var(--text-dim);padding:8px 0">no active cron jobs</div>`;
                        return;
                    }
                    $("#_sxc_msg").textContent = lines.length + " job" + (lines.length === 1 ? "" : "s");
                    let html = "";
                    lines.slice(0, 60).forEach(l => {
                        // split schedule (first 5 fields) from command; handle @reboot etc.
                        let sched = "", cmd = l.trim();
                        if (l.trim().startsWith("@")) {
                            const p = l.trim().split(/\s+/);
                            sched = p[0]; cmd = p.slice(1).join(" ");
                        } else {
                            const p = l.trim().split(/\s+/);
                            sched = p.slice(0, 5).join(" "); cmd = p.slice(5).join(" ");
                        }
                        html += `<div style="padding:3px 0;border-top:1px solid var(--border)">`
                            + `<div style="color:var(--accent)">${esc(sched)}</div>`
                            + `<div style="color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(cmd)}</div></div>`;
                    });
                    $("#_sxc_body").innerHTML = html;
                } catch (e) {
                    $("#_sxc_msg").textContent = "error";
                } finally { busy = false; }
            };
            tick();
            const iv = setInterval(tick, 15000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
