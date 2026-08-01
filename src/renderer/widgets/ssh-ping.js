"use strict";
window.I18N.register({
    en: { "widget.sshping": "SSH Radar", "cat.ssh": "SSH" },
    ru: { "widget.sshping": "SSH радар", "cat.ssh": "SSH" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
    const DEFAULTS = ["1.1.1.1", "8.8.8.8"];

    function parseRtt(stdout) {
        const m = /time[=<]\s*([\d.]+)\s*ms/i.exec(stdout || "");
        return m ? parseFloat(m[1]) : null;
    }

    window.WIDGETS.sshping = {
        id: "sshping",
        title: "widget.sshping",
        category: "ssh",
        description: "Ping radar: reachability + RTT for your hosts",
        defaultSize: { w: 6, h: 4 },
        mount(body) {
            let alive = true, busy = false;
            let hosts = DEFAULTS.slice();

            body.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                    <span style="color:var(--text-dim);font-size:11px">reachable / RTT</span>
                    <span>
                        <button id="_shp_add" title="Add host" style="border:1px dashed var(--border-strong);background:transparent;color:var(--accent);border-radius:6px;padding:2px 8px;cursor:pointer;font-family:var(--font-ui);font-size:11px">+ host</button>
                    </span>
                </div>
                <div id="_shp_list" style="overflow:auto"></div>`;
            const list = body.querySelector("#_shp_list");

            function save() { window.dyo.settings.set({ "ssh.pingHosts": hosts }); }

            function rowFor(host) {
                const row = document.createElement("div");
                row.className = "metric-row";
                row.style.cssText = "align-items:center;gap:8px";
                row.innerHTML = `
                    <span class="k" style="font-family:var(--font-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0" title="${esc(host)}">${esc(host)}</span>
                    <span class="v" data-role="rtt" style="min-width:56px;text-align:right">…</span>
                    <button data-role="del" title="Remove" style="border:none;background:transparent;color:var(--text-dim);cursor:pointer;font-size:13px;padding:0 2px">✕</button>`;
                row.querySelector('[data-role="del"]').onclick = () => {
                    hosts = hosts.filter(h => h !== host);
                    save();
                    render();
                    tick();
                };
                return row;
            }

            const rowMap = new Map();
            function render() {
                list.innerHTML = "";
                rowMap.clear();
                if (!hosts.length) {
                    list.innerHTML = `<div style="color:var(--text-dim);font-size:12px">No hosts. Click "+ host".</div>`;
                    return;
                }
                hosts.forEach(h => {
                    const row = rowFor(h);
                    rowMap.set(h, row);
                    list.appendChild(row);
                });
            }

            function setRtt(host, text, color) {
                const row = rowMap.get(host);
                if (!row) return;
                const v = row.querySelector('[data-role="rtt"]');
                v.textContent = text;
                v.style.color = color;
            }

            async function tick() {
                if (!alive || busy || !hosts.length) return;
                busy = true;
                try {
                    await Promise.all(hosts.map(async host => {
                        try {
                            const r = await window.dyo.exec("ping", ["-c", "1", "-t", "2", host], { timeout: 4000 });
                            if (r && r.code === 0) {
                                const rtt = parseRtt(r.stdout);
                                if (rtt != null) setRtt(host, rtt.toFixed(1) + " ms", rtt < 80 ? "var(--accent2)" : "var(--accent)");
                                else setRtt(host, "up", "var(--accent2)");
                            } else {
                                setRtt(host, "down", "var(--danger)");
                            }
                        } catch (e) {
                            setRtt(host, "down", "var(--danger)");
                        }
                    }));
                } finally {
                    busy = false;
                }
            }

            body.querySelector("#_shp_add").onclick = () => {
                const h = prompt("Host or IP to ping:");
                if (!h) return;
                const host = h.trim();
                if (!host || hosts.indexOf(host) >= 0) return;
                hosts.push(host);
                save();
                render();
                tick();
            };

            window.dyo.settings.get().then(s => {
                if (!alive) return;
                if (s && Array.isArray(s["ssh.pingHosts"]) && s["ssh.pingHosts"].length) hosts = s["ssh.pingHosts"].slice();
                render();
                tick();
            });

            render();
            const iv = setInterval(tick, 5000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
