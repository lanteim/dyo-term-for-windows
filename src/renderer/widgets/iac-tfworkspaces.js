"use strict";
window.I18N.register({
    en: { "widget.iac_tfworkspaces": "Terraform Workspaces", "cat.iac": "IaC" },
    ru: { "widget.iac_tfworkspaces": "Воркспейсы Terraform", "cat.iac": "IaC" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.iac_tfworkspaces = {
    id: "iac_tfworkspaces",
    title: "widget.iac_tfworkspaces",
    category: "iac",
    description: "terraform workspace list; highlights the selected workspace",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
            <div class="metric-row"><span class="k">🌿 CURRENT</span><span class="v"><b id="_tw_cur" style="color:var(--accent)">…</b></span></div>
            <div id="_tw_msg" style="color:var(--text-dim);font-size:11px"></div>
            <div id="_tw_list" style="flex:1;overflow:auto;font-family:var(--font-mono);font-size:12px;display:flex;flex-direction:column;gap:2px"></div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto">
              <span id="_tw_meta" style="color:var(--text-dim);font-size:10.5px"></span>
              <button id="_tw_ref" title="Refresh" aria-label="Refresh" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">↻</button>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const cwd = () => (window.term ? window.term.lastCwd : undefined);

        const select = ws => { if (ws) window.term.runInFocused("terraform workspace select " + ws.replace(/[^A-Za-z0-9_.-]/g, "") + "\n"); };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true; $("#_tw_meta").textContent = "loading…";
            try {
                const r = await window.dyo.exec("terraform", ["workspace", "list"], { cwd: cwd(), timeout: 12000 });
                if (!alive) return;
                if (!r || (r.code !== 0 && !(r.stdout || "").trim())) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n")[0] : "terraform not found";
                    $("#_tw_cur").textContent = "—";
                    $("#_tw_list").innerHTML = "";
                    $("#_tw_msg").innerHTML = `<span style="color:var(--danger)">${esc(err)}</span> — run in an initialized Terraform dir.`;
                    return;
                }
                $("#_tw_msg").textContent = "";
                const lines = (r.stdout || "").split("\n").map(l => l.trimEnd()).filter(l => l.trim());
                const list = $("#_tw_list");
                list.innerHTML = "";
                let current = "—";
                lines.forEach(l => {
                    const isCur = l.trim().startsWith("*");
                    const name = l.replace(/^\s*\*?\s*/, "").trim();
                    if (!name) return;
                    if (isCur) current = name;
                    const div = document.createElement("div");
                    div.style.cssText = "display:flex;align-items:center;gap:6px;padding:3px 6px;border:1px solid var(--border);border-radius:5px;cursor:pointer;" + (isCur ? "background:var(--bg-elevated)" : "");
                    div.innerHTML = `<span style="color:${isCur ? "var(--accent)" : "var(--text-dim)"}">${isCur ? "●" : "○"}</span><span${isCur ? ' style="color:var(--accent);font-weight:600"' : ""}>${esc(name)}</span>`;
                    div.title = "Select workspace " + name;
                    div.onclick = () => select(name);
                    list.appendChild(div);
                });
                $("#_tw_cur").textContent = current;
                $("#_tw_meta").textContent = lines.length + " workspace" + (lines.length === 1 ? "" : "s") + " · click to select";
            } catch (e) {
                if (alive) $("#_tw_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };
        $("#_tw_ref").onclick = tick;
        tick();
        const iv = setInterval(tick, 30000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
