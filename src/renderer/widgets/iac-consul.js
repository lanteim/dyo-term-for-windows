"use strict";
window.I18N.register({
    en: { "widget.iac_consul": "Consul Members", "cat.iac": "IaC" },
    ru: { "widget.iac_consul": "Узлы Consul", "cat.iac": "IaC" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.iac_consul = {
    id: "iac_consul",
    title: "widget.iac_consul",
    category: "iac",
    description: "consul members: node name, address, status, type, dc",
    defaultSize: { w: 10, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
            <div class="metric-row"><span class="k">🧿 MEMBERS</span><span class="v"><b id="_cs_alive" style="color:var(--accent2)">…</b><span id="_cs_total" style="color:var(--text-dim)"></span></span></div>
            <div id="_cs_msg" style="color:var(--text-dim);font-size:11px"></div>
            <div style="flex:1;overflow:auto">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px">NODE</th><th style="padding:2px 6px">ADDRESS</th>
                  <th style="padding:2px 6px">STATUS</th><th style="padding:2px 6px">TYPE</th><th style="padding:2px 6px">DC</th>
                </tr></thead>
                <tbody id="_cs_rows"></tbody>
              </table>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto">
              <span id="_cs_meta" style="color:var(--text-dim);font-size:10.5px"></span>
              <button id="_cs_ref" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">↻</button>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const cwd = () => (window.term ? window.term.lastCwd : undefined);

        const tick = async () => {
            if (!alive || busy) return;
            busy = true; $("#_cs_meta").textContent = "loading…";
            try {
                const r = await window.dyo.exec("consul", ["members"], { cwd: cwd(), timeout: 12000 });
                if (!alive) return;
                if (!r || r.code !== 0 || !(r.stdout || "").trim()) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n")[0] : "consul not found / agent not running";
                    $("#_cs_alive").textContent = "—"; $("#_cs_total").textContent = ""; $("#_cs_rows").innerHTML = "";
                    $("#_cs_msg").innerHTML = `<span style="color:var(--danger)">${esc(err)}</span> — needs a reachable Consul agent (CONSUL_HTTP_ADDR).`;
                    return;
                }
                $("#_cs_msg").textContent = "";
                const lines = (r.stdout || "").trim().split("\n").filter(l => l.trim());
                // header: Node  Address  Status  Type  Build  Protocol  DC  Partition/Segment
                const data = lines.slice(1).map(l => l.split(/\s{2,}/));
                let up = 0;
                $("#_cs_rows").innerHTML = data.slice(0, 200).map(c => {
                    const node = c[0] || "", address = c[1] || "", status = (c[2] || "").trim(), type = c[3] || "", dc = c[6] || "";
                    const isAlive = /alive/i.test(status);
                    if (isAlive) up++;
                    const col = isAlive ? "var(--accent2)" : (/left|failed/i.test(status) ? "var(--danger)" : "var(--text-dim)");
                    return `<tr style="border-top:1px solid var(--border)">
                      <td style="padding:2px 6px">${esc(node)}</td>
                      <td style="padding:2px 6px;color:var(--text-dim)">${esc(address)}</td>
                      <td style="padding:2px 6px;color:${col}">${esc(status)}</td>
                      <td style="padding:2px 6px;color:var(--text-dim)">${esc(type)}</td>
                      <td style="padding:2px 6px;color:var(--text-dim)">${esc(dc)}</td></tr>`;
                }).join("");
                $("#_cs_alive").textContent = String(up);
                $("#_cs_total").textContent = " / " + data.length;
                $("#_cs_meta").textContent = "updated " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) $("#_cs_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };
        $("#_cs_ref").onclick = tick;
        tick();
        const iv = setInterval(tick, 20000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
