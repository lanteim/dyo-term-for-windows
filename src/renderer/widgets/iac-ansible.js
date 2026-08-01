"use strict";
window.I18N.register({
    en: { "widget.iac_ansible": "Ansible Inventory", "cat.iac": "IaC" },
    ru: { "widget.iac_ansible": "Инвентарь Ansible", "cat.iac": "IaC" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.iac_ansible = {
    id: "iac_ansible",
    title: "widget.iac_ansible",
    category: "iac",
    description: "ansible-inventory --list: host count grouped by inventory group",
    defaultSize: { w: 8, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
            <div class="metric-row"><span class="k">🖧 HOSTS</span><span class="v"><b id="_an_hosts" style="font-size:16px;color:var(--accent2)">…</b><span id="_an_groups" style="color:var(--text-dim);margin-left:8px"></span></span></div>
            <div id="_an_msg" style="color:var(--text-dim);font-size:11px"></div>
            <div id="_an_list" style="flex:1;overflow:auto;font-family:var(--font-mono);font-size:11px;display:flex;flex-direction:column;gap:1px"></div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto">
              <span id="_an_meta" style="color:var(--text-dim);font-size:10.5px"></span>
              <button id="_an_ref" title="Refresh" aria-label="Refresh" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">↻</button>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const cwd = () => (window.term ? window.term.lastCwd : undefined);

        const tick = async () => {
            if (!alive || busy) return;
            busy = true; $("#_an_meta").textContent = "loading…";
            try {
                const r = await window.dyo.exec("ansible-inventory", ["--list"], { cwd: cwd(), timeout: 15000 });
                if (!alive) return;
                if (!r || r.code !== 0 || !(r.stdout || "").trim()) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n")[0] : "ansible-inventory not found";
                    $("#_an_hosts").textContent = "—"; $("#_an_groups").textContent = "";
                    $("#_an_list").innerHTML = "";
                    $("#_an_msg").innerHTML = `<span style="color:var(--danger)">${esc(err)}</span> — run in a dir with an inventory (or ansible.cfg).`;
                    return;
                }
                let j = null;
                try { j = JSON.parse(r.stdout); } catch (e) { j = null; }
                if (!j || typeof j !== "object") {
                    $("#_an_msg").innerHTML = `<span style="color:var(--danger)">unparseable inventory JSON</span>`;
                    return;
                }
                $("#_an_msg").textContent = "";
                const meta = j._meta && j._meta.hostvars ? j._meta.hostvars : {};
                const allHosts = new Set(Object.keys(meta));
                const groups = [];
                Object.keys(j).forEach(g => {
                    if (g === "_meta") return;
                    const node = j[g] || {};
                    const hosts = Array.isArray(node.hosts) ? node.hosts : [];
                    hosts.forEach(h => allHosts.add(h));
                    if (g === "all") return;
                    if (hosts.length) groups.push({ name: g, hosts });
                });
                $("#_an_hosts").textContent = String(allHosts.size);
                $("#_an_groups").textContent = groups.length + " group" + (groups.length === 1 ? "" : "s");
                const list = $("#_an_list");
                list.innerHTML = "";
                groups.sort((a, b) => b.hosts.length - a.hosts.length).slice(0, 200).forEach(g => {
                    const row = document.createElement("div");
                    row.className = "metric-row";
                    row.style.cssText = "border-bottom:1px solid var(--border);padding:2px 0";
                    row.innerHTML = `<span class="k" style="color:var(--accent)">${esc(g.name)}</span><span class="v" style="color:var(--text-dim)" title="${esc(g.hosts.slice(0, 40).join(", "))}">${g.hosts.length} host${g.hosts.length === 1 ? "" : "s"}</span>`;
                    list.appendChild(row);
                });
                if (!groups.length && allHosts.size) {
                    list.innerHTML = `<div style="color:var(--text-dim)">${Array.from(allHosts).slice(0, 60).map(esc).join("<br>")}</div>`;
                }
                $("#_an_meta").textContent = "updated " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) $("#_an_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };
        $("#_an_ref").onclick = tick;
        tick();
        const iv = setInterval(tick, 30000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
