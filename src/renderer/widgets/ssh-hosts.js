"use strict";
window.I18N.register({
    en: { "widget.sshhosts": "SSH Hosts", "cat.ssh": "SSH" },
    ru: { "widget.sshhosts": "SSH хосты", "cat.ssh": "SSH" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
    const shq = s => "'" + String(s).replace(/'/g, "'\\''") + "'";

    window.WIDGETS.sshhosts = {
        id: "sshhosts",
        title: "widget.sshhosts",
        category: "ssh",
        description: "Quick-connect buttons parsed from ~/.ssh/config",
        defaultSize: { w: 6, h: 4 },
        mount(body) {
            let alive = true;
            body.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                    <span style="color:var(--text-dim);font-size:11px" id="_shh_meta">reading ~/.ssh/config…</span>
                    <button id="_shh_reload" title="Reload" style="border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-dim);border-radius:6px;padding:2px 8px;cursor:pointer;font-family:var(--font-ui);font-size:11px">↻</button>
                </div>
                <div id="_shh_list" style="display:flex;flex-wrap:wrap;gap:6px;align-content:flex-start;overflow:auto"></div>`;
            const meta = body.querySelector("#_shh_meta");
            const list = body.querySelector("#_shh_list");

            function info(msg) { meta.textContent = msg; }

            function parseHosts(text) {
                const hosts = [];
                const seen = Object.create(null);
                text.split(/\r?\n/).forEach(line => {
                    const m = /^\s*Host\s+(.+?)\s*$/i.exec(line);
                    if (!m) return;
                    m[1].split(/\s+/).forEach(name => {
                        if (!name || name.indexOf("*") >= 0 || name.indexOf("?") >= 0) return;
                        if (seen[name]) return;
                        seen[name] = true;
                        hosts.push(name);
                    });
                });
                return hosts;
            }

            function render(hosts) {
                list.innerHTML = "";
                if (!hosts.length) {
                    list.innerHTML = `<div style="color:var(--text-dim);font-size:12px">No named hosts found.</div>`;
                    return;
                }
                hosts.forEach(h => {
                    const b = document.createElement("button");
                    b.textContent = h;
                    b.title = "ssh " + h;
                    b.style.cssText = "border:1px solid var(--border);background:var(--bg-elevated);color:var(--text);border-radius:8px;padding:6px 10px;cursor:pointer;font-family:var(--font-mono);font-size:12px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
                    b.onclick = () => { if (window.term) window.term.runInFocused("ssh " + shq(h) + "\n"); };
                    list.appendChild(b);
                });
            }

            async function load() {
                if (!alive) return;
                info("reading ~/.ssh/config…");
                try {
                    const ai = await window.dyo.appInfo();
                    const home = ai && ai.home ? ai.home : "";
                    if (!home) { info("home directory unavailable"); render([]); return; }
                    const res = await window.dyo.fs.read(home + "/.ssh/config");
                    if (!res || res.error || res.content == null) {
                        info("~/.ssh/config not found");
                        render([]);
                        return;
                    }
                    const hosts = parseHosts(res.content);
                    info(hosts.length + " host" + (hosts.length === 1 ? "" : "s") + " · ~/.ssh/config");
                    render(hosts);
                } catch (e) {
                    info("could not read ~/.ssh/config");
                    render([]);
                }
            }

            body.querySelector("#_shh_reload").onclick = load;
            load();
            return { destroy: () => { alive = false; } };
        }
    };
})();
