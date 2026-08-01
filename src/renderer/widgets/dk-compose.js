"use strict";
window.I18N.register({
    en: { "widget.dockercompose": "Docker Compose", "cat.docker": "Docker" },
    ru: { "widget.dockercompose": "Docker Compose", "cat.docker": "Docker" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.dockercompose = {
        id: "dockercompose",
        title: "widget.dockercompose",
        category: "docker",
        description: "Compose projects & current-dir services",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🧩 COMPOSE</span>
                    <span id="_dkcp_msg" style="color:var(--text-dim);margin-left:auto"></span>
                  </div>
                  <div id="_dkcp_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:2px"><div style="color:var(--text-dim);padding:10px">Loading…</div></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const diagnose = (res) => {
                const err = (res && (res.stderr || "")).toLowerCase();
                if (err.includes("cannot connect") || err.includes("daemon")) return "docker daemon not running";
                if (err.includes("not found") || err.includes("is not a docker command") || (res && res.code === 127)) return "docker compose not available";
                return "docker not available";
            };

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const cwd = window.term ? window.term.lastCwd : undefined;
                    const [ls, ps] = await Promise.all([
                        window.dyo.exec("docker", ["compose", "ls", "--format", "json"], { timeout: 8000 }),
                        window.dyo.exec("docker", ["compose", "ps", "--format", "{{.Name}}\t{{.Service}}\t{{.State}}"], { cwd, timeout: 8000 })
                    ]);

                    if (!ls || ls.code !== 0) {
                        const msg = diagnose(ls);
                        $("#_dkcp_msg").textContent = "";
                        $("#_dkcp_body").innerHTML = `<div style="color:var(--text-dim);padding:10px">${esc(msg)}</div>`;
                        return;
                    }
                    $("#_dkcp_msg").textContent = "";

                    let projects = [];
                    try {
                        const parsed = JSON.parse(ls.stdout.trim() || "[]");
                        if (Array.isArray(parsed)) projects = parsed;
                    } catch (e) { projects = []; }

                    let html = "";

                    // Global compose projects
                    html += `<div style="color:var(--text-dim);padding:4px 8px 2px;font-size:10.5px;letter-spacing:1px">PROJECTS</div>`;
                    if (!projects.length) {
                        html += `<div style="color:var(--text-dim);padding:2px 8px 8px">no running compose projects</div>`;
                    } else {
                        projects.slice(0, 100).forEach(p => {
                            const name = p.Name || p.name || "";
                            const status = p.Status || p.status || "";
                            const running = /running|up/i.test(status);
                            html += `<div class="metric-row" style="padding:2px 8px"><span class="k" style="color:var(--text)">${esc(name)}</span><span class="v" style="color:${running ? "var(--accent2)" : "var(--text-dim)"}">${esc(status)}</span></div>`;
                        });
                    }

                    // Current dir services
                    html += `<div style="color:var(--text-dim);padding:8px 8px 2px;font-size:10.5px;letter-spacing:1px">THIS DIRECTORY</div>`;
                    if (!ps || ps.code !== 0) {
                        html += `<div style="color:var(--text-dim);padding:2px 8px 8px">not a compose project here</div>`;
                    } else {
                        const rows = ps.stdout.split("\n").filter(l => l.trim()).map(l => {
                            const p = l.split("\t");
                            return { name: p[0] || "", service: p[1] || "", state: p[2] || "" };
                        });
                        if (!rows.length) {
                            html += `<div style="color:var(--text-dim);padding:2px 8px 8px">no services / not a compose project here</div>`;
                        } else {
                            rows.slice(0, 100).forEach(r => {
                                const up = /running|up/i.test(r.state);
                                html += `<div class="metric-row" style="padding:2px 8px"><span class="k" style="color:var(--text)">${esc(r.service || r.name)}</span><span class="v" style="color:${up ? "var(--accent2)" : "var(--danger)"}">${esc(r.state)}</span></div>`;
                            });
                        }
                    }

                    $("#_dkcp_body").innerHTML = html;
                } catch (e) {
                    $("#_dkcp_msg").textContent = "error";
                } finally { busy = false; }
            };
            tick();
            const iv = setInterval(tick, 6000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
