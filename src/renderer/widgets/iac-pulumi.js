"use strict";
window.I18N.register({
    en: { "widget.iac_pulumi": "Pulumi Stacks", "cat.iac": "IaC" },
    ru: { "widget.iac_pulumi": "Стеки Pulumi", "cat.iac": "IaC" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.iac_pulumi = {
    id: "iac_pulumi",
    title: "widget.iac_pulumi",
    category: "iac",
    description: "pulumi stack ls --json: stacks, resource count, last update, current marker",
    defaultSize: { w: 10, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
            <div class="metric-row"><span class="k">🧱 STACKS</span><span class="v"><b id="_pu_count" style="font-size:15px;color:var(--accent2)">…</b></span></div>
            <div id="_pu_msg" style="color:var(--text-dim);font-size:11px"></div>
            <div style="flex:1;overflow:auto">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:2px 6px">STACK</th><th style="padding:2px 6px">RES</th>
                  <th style="padding:2px 6px">LAST UPDATE</th>
                </tr></thead>
                <tbody id="_pu_rows"></tbody>
              </table>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto">
              <span id="_pu_meta" style="color:var(--text-dim);font-size:10.5px"></span>
              <button id="_pu_ref" title="Refresh" aria-label="Refresh" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">↻</button>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const cwd = () => (window.term ? window.term.lastCwd : undefined);

        const rel = t => {
            if (!t) return "never";
            const d = new Date(t); if (isNaN(d)) return String(t);
            const diff = (Date.now() - d.getTime()) / 1000;
            if (diff < 60) return Math.round(diff) + "s ago";
            if (diff < 3600) return Math.round(diff / 60) + "m ago";
            if (diff < 86400) return Math.round(diff / 3600) + "h ago";
            return Math.round(diff / 86400) + "d ago";
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true; $("#_pu_meta").textContent = "loading…";
            try {
                const r = await window.dyo.exec("pulumi", ["stack", "ls", "--json"], { cwd: cwd(), timeout: 15000 });
                if (!alive) return;
                if (!r || r.code !== 0 || !(r.stdout || "").trim()) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n")[0] : "pulumi not found";
                    $("#_pu_count").textContent = "—"; $("#_pu_rows").innerHTML = "";
                    $("#_pu_msg").innerHTML = `<span style="color:var(--danger)">${esc(err)}</span> — run in a Pulumi project, logged into a backend.`;
                    return;
                }
                let j = null;
                try { j = JSON.parse(r.stdout); } catch (e) { j = null; }
                if (!Array.isArray(j)) { $("#_pu_msg").innerHTML = `<span style="color:var(--danger)">unparseable response</span>`; return; }
                $("#_pu_msg").textContent = "";
                $("#_pu_count").textContent = String(j.length);
                $("#_pu_rows").innerHTML = j.slice(0, 200).map(s => {
                    const cur = s.current ? '<span style="color:var(--accent)">● </span>' : "";
                    const name = (s.name || "") + "";
                    return `<tr style="border-top:1px solid var(--border)">
                      <td style="padding:2px 6px${s.current ? ";color:var(--accent);font-weight:600" : ""}">${cur}${esc(name)}</td>
                      <td style="padding:2px 6px;color:var(--text-dim)">${esc(s.resourceCount == null ? "—" : s.resourceCount)}</td>
                      <td style="padding:2px 6px;color:var(--text-dim)">${esc(rel(s.lastUpdate))}</td></tr>`;
                }).join("");
                if (!j.length) $("#_pu_rows").innerHTML = `<tr><td colspan="3" style="padding:6px;color:var(--text-dim)">No stacks yet.</td></tr>`;
                $("#_pu_meta").textContent = "updated " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) $("#_pu_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };
        $("#_pu_ref").onclick = tick;
        tick();
        const iv = setInterval(tick, 30000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
