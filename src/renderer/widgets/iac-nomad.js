"use strict";
window.I18N.register({
    en: { "widget.iac_nomad": "Nomad Jobs", "cat.iac": "IaC" },
    ru: { "widget.iac_nomad": "Задачи Nomad", "cat.iac": "IaC" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.iac_nomad = {
    id: "iac_nomad",
    title: "widget.iac_nomad",
    category: "iac",
    description: "nomad status: jobs with type, priority and status",
    defaultSize: { w: 10, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
            <div class="metric-row"><span class="k">📦 JOBS</span><span class="v"><b id="_nm_run" style="color:var(--accent2)">…</b><span id="_nm_total" style="color:var(--text-dim)"></span></span></div>
            <div id="_nm_msg" style="color:var(--text-dim);font-size:11px"></div>
            <div style="flex:1;overflow:auto">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px">ID</th><th style="padding:2px 6px">TYPE</th>
                  <th style="padding:2px 6px">PRIO</th><th style="padding:2px 6px">STATUS</th>
                </tr></thead>
                <tbody id="_nm_rows"></tbody>
              </table>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto">
              <span id="_nm_meta" style="color:var(--text-dim);font-size:10.5px"></span>
              <button id="_nm_ref" title="Refresh" aria-label="Refresh" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">↻</button>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const cwd = () => (window.term ? window.term.lastCwd : undefined);

        const tick = async () => {
            if (!alive || busy) return;
            busy = true; $("#_nm_meta").textContent = "loading…";
            try {
                const r = await window.dyo.exec("nomad", ["status"], { cwd: cwd(), timeout: 12000 });
                if (!alive) return;
                if (!r || r.code !== 0 || !(r.stdout || "").trim()) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n")[0] : "nomad not found / agent unreachable";
                    $("#_nm_run").textContent = "—"; $("#_nm_total").textContent = ""; $("#_nm_rows").innerHTML = "";
                    $("#_nm_msg").innerHTML = `<span style="color:var(--danger)">${esc(err)}</span> — set NOMAD_ADDR to a reachable Nomad server.`;
                    return;
                }
                const out = (r.stdout || "").trim();
                if (/No running jobs/i.test(out)) {
                    $("#_nm_run").textContent = "0"; $("#_nm_total").textContent = " / 0"; $("#_nm_rows").innerHTML = "";
                    $("#_nm_msg").textContent = "No jobs registered.";
                    $("#_nm_meta").textContent = "updated " + new Date().toLocaleTimeString(window.I18N.locale());
                    return;
                }
                $("#_nm_msg").textContent = "";
                const lines = out.split("\n").filter(l => l.trim());
                // header: ID  Type  Priority  Status  Submit Date
                const data = lines.slice(1).map(l => l.split(/\s{2,}/));
                let running = 0;
                $("#_nm_rows").innerHTML = data.slice(0, 200).map(c => {
                    const id = c[0] || "", type = c[1] || "", prio = c[2] || "", status = (c[3] || "").trim();
                    const isRun = /running/i.test(status);
                    if (isRun) running++;
                    const col = isRun ? "var(--accent2)" : (/dead|failed/i.test(status) ? "var(--danger)" : "var(--accent)");
                    return `<tr style="border-top:1px solid var(--border)">
                      <td style="padding:2px 6px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(id)}</td>
                      <td style="padding:2px 6px;color:var(--text-dim)">${esc(type)}</td>
                      <td style="padding:2px 6px;color:var(--text-dim)">${esc(prio)}</td>
                      <td style="padding:2px 6px;color:${col}">${esc(status)}</td></tr>`;
                }).join("");
                $("#_nm_run").textContent = String(running);
                $("#_nm_total").textContent = " / " + data.length;
                $("#_nm_meta").textContent = "updated " + new Date().toLocaleTimeString(window.I18N.locale());
            } catch (e) {
                if (alive) $("#_nm_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };
        $("#_nm_ref").onclick = tick;
        tick();
        const iv = setInterval(tick, 20000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
