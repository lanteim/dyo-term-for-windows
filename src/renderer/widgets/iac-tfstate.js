"use strict";
window.I18N.register({
    en: { "widget.iac_tfstate": "Terraform State", "cat.iac": "IaC" },
    ru: { "widget.iac_tfstate": "Состояние Terraform", "cat.iac": "IaC" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.iac_tfstate = {
    id: "iac_tfstate",
    title: "widget.iac_tfstate",
    category: "iac",
    description: "terraform state list: resource count + resource addresses",
    defaultSize: { w: 8, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
            <div class="metric-row"><span class="k">🗿 RESOURCES</span><span class="v"><b id="_ts_count" style="font-size:16px;color:var(--accent2)">…</b></span></div>
            <div id="_ts_msg" style="color:var(--text-dim);font-size:11px"></div>
            <div id="_ts_list" style="flex:1;overflow:auto;font-family:var(--font-mono);font-size:11px;display:flex;flex-direction:column;gap:1px"></div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto">
              <span id="_ts_meta" style="color:var(--text-dim);font-size:10.5px"></span>
              <button id="_ts_ref" title="Refresh" aria-label="Refresh" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">↻</button>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const cwd = () => (window.term ? window.term.lastCwd : undefined);

        const tick = async () => {
            if (!alive || busy) return;
            busy = true; $("#_ts_meta").textContent = "loading…";
            try {
                const r = await window.dyo.exec("terraform", ["state", "list"], { cwd: cwd(), timeout: 15000 });
                if (!alive) return;
                if (!r || (r.code !== 0 && !(r.stdout || "").trim())) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n")[0] : "terraform not found";
                    $("#_ts_count").textContent = "—";
                    $("#_ts_list").innerHTML = "";
                    $("#_ts_msg").innerHTML = `<span style="color:var(--danger)">${esc(err)}</span> — run in a Terraform dir with an initialized backend.`;
                    return;
                }
                const lines = (r.stdout || "").trim().split("\n").filter(l => l.trim());
                $("#_ts_count").textContent = String(lines.length);
                $("#_ts_msg").textContent = lines.length ? "" : "Empty state — nothing applied yet.";
                const list = $("#_ts_list");
                list.innerHTML = "";
                lines.slice(0, 200).forEach(l => {
                    const div = document.createElement("div");
                    div.style.cssText = "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-bottom:1px solid var(--border);padding:1px 0";
                    div.textContent = l;
                    div.title = l;
                    list.appendChild(div);
                });
                if (lines.length > 200) {
                    const more = document.createElement("div");
                    more.style.cssText = "color:var(--text-dim);padding:2px 0";
                    more.textContent = "… +" + (lines.length - 200) + " more";
                    list.appendChild(more);
                }
                $("#_ts_meta").textContent = "updated " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) $("#_ts_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };
        $("#_ts_ref").onclick = tick;
        tick();
        const iv = setInterval(tick, 30000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
