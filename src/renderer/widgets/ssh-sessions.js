"use strict";
window.I18N.register({
    en: { "widget.sshsessions": "SSH Sessions", "cat.ssh": "SSH" },
    ru: { "widget.sshsessions": "SSH сессии", "cat.ssh": "SSH" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.sshsessions = {
        id: "sshsessions",
        title: "widget.sshsessions",
        category: "ssh",
        description: "Active outbound ssh clients + logged-in users",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            let alive = true, busy = false;
            body.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                    <span style="color:var(--text-dim);font-size:11px">outbound ssh clients</span>
                    <span class="v" id="_shs_count" style="font-size:11px">…</span>
                </div>
                <div id="_shs_list" style="overflow:auto;font-family:var(--font-mono);font-size:11px;max-height:120px"></div>
                <div id="_shs_who" style="color:var(--text-dim);font-size:11px;margin-top:6px;border-top:1px solid var(--border);padding-top:6px"></div>`;
            const count = body.querySelector("#_shs_count");
            const list = body.querySelector("#_shs_list");
            const who = body.querySelector("#_shs_who");

            async function tick() {
                if (!alive || busy) return;
                busy = true;
                try {
                    const ps = await window.dyo.exec("ps", ["-axo", "pid,command"], { timeout: 5000 });
                    if (!ps || ps.code !== 0 || !ps.stdout) {
                        list.innerHTML = `<div style="color:var(--text-dim)">ps unavailable</div>`;
                        count.textContent = "—";
                    } else {
                        const lines = ps.stdout.split(/\r?\n/).slice(1);
                        const sessions = [];
                        for (const line of lines) {
                            const m = /^\s*(\d+)\s+(.*)$/.exec(line);
                            if (!m) continue;
                            const cmd = m[2];
                            // client sessions: an "ssh " invocation, exclude daemon/agent/known helper procs
                            if (!/(^|\/)ssh\s/.test(cmd)) continue;
                            if (/sshd|ssh-agent|ssh-keysign|ssh-add|autossh$/.test(cmd)) continue;
                            sessions.push({ pid: m[1], cmd: cmd });
                            if (sessions.length >= 200) break;
                        }
                        count.textContent = sessions.length + " active";
                        count.style.color = sessions.length ? "var(--accent2)" : "var(--text-dim)";
                        if (!sessions.length) {
                            list.innerHTML = `<div style="color:var(--text-dim)">no active ssh sessions</div>`;
                        } else {
                            list.innerHTML = sessions.map(s =>
                                `<div class="metric-row" style="gap:8px"><span class="k" style="min-width:44px">${esc(s.pid)}</span><span class="v" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(s.cmd)}">${esc(s.cmd)}</span></div>`
                            ).join("");
                        }
                    }

                    const w = await window.dyo.exec("who", [], { timeout: 4000 });
                    if (w && w.code === 0 && w.stdout.trim()) {
                        const users = w.stdout.split(/\r?\n/).filter(l => l.trim()).length;
                        who.textContent = users + " logged-in session" + (users === 1 ? "" : "s") + " (who)";
                    } else {
                        who.textContent = "";
                    }
                } catch (e) {
                    list.innerHTML = `<div style="color:var(--text-dim)">error reading processes</div>`;
                } finally {
                    busy = false;
                }
            }

            tick();
            const iv = setInterval(tick, 4000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
