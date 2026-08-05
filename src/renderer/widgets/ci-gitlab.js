"use strict";
window.I18N.register({
    en: { "widget.ci_gitlab": "GitLab Pipelines", "cat.cicd": "CI/CD" },
    ru: { "widget.ci_gitlab": "GitLab Pipelines", "cat.cicd": "CI/CD" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.ci_gitlab = {
    id: "ci_gitlab",
    title: "widget.ci_gitlab",
    category: "cicd",
    description: "GitLab CI pipelines for a project (status, ref, when)",
    defaultSize: { w: 8, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div id="_gl_cfg" style="display:none;flex-direction:column;gap:6px">
              <input id="_gl_url" placeholder="https://gitlab.com" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <input id="_gl_token" type="password" placeholder="Personal access token (read_api)" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <input id="_gl_pid" placeholder="Project ID (e.g. 278964) or group%2Fproject" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <button id="_gl_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px">Save</button>
            </div>
            <div id="_gl_main" style="display:none;flex-direction:column;gap:6px;height:100%">
              <div class="metric-row"><span class="k">🦊 Pipelines</span><span class="v" id="_gl_sum">…</span></div>
              <div id="_gl_list" style="display:flex;flex-direction:column;gap:1px;overflow:auto;font-family:var(--font-mono);font-size:11.5px;flex:1"></div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto">
                <span id="_gl_meta" style="color:var(--text-dim);font-size:11px"></span>
                <button id="_gl_edit" title="Settings" aria-label="Settings" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">⚙</button>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        let url = "", token = "", pid = "";
        const base = () => url.replace(/\/+$/, "");
        const showCfg = show => { $("#_gl_cfg").style.display = show ? "flex" : "none"; $("#_gl_main").style.display = show ? "none" : "flex"; };

        const col = st => {
            if (st === "success") return "var(--accent2)";
            if (st === "failed") return "var(--danger)";
            if (st === "running" || st === "pending" || st === "created" || st === "waiting_for_resource" || st === "preparing") return "var(--accent)";
            if (st === "canceled" || st === "skipped" || st === "manual") return "var(--text-dim)";
            return "var(--text)";
        };
        const ago = iso => {
            if (!iso) return "";
            const d = (Date.now() - new Date(iso).getTime()) / 1000;
            if (isNaN(d)) return "";
            if (d < 60) return Math.round(d) + "s";
            if (d < 3600) return Math.round(d / 60) + "m";
            if (d < 86400) return Math.round(d / 3600) + "h";
            return Math.round(d / 86400) + "d";
        };

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            url = (s && s["ci.gitlab.url"]) || "https://gitlab.com";
            token = (s && s["ci.gitlab.token"]) || "";
            pid = (s && s["ci.gitlab.pid"]) || "";
            $("#_gl_url").value = url; $("#_gl_token").value = token; $("#_gl_pid").value = pid;
            if (!token || !pid) showCfg(true); else { showCfg(false); tick(); }
        });

        $("#_gl_save").onclick = async () => {
            url = $("#_gl_url").value.trim() || "https://gitlab.com";
            token = $("#_gl_token").value.trim();
            pid = $("#_gl_pid").value.trim();
            await window.dyo.settings.set({ "ci.gitlab.url": url, "ci.gitlab.token": token, "ci.gitlab.pid": pid });
            if (token && pid) { showCfg(false); tick(); }
        };
        $("#_gl_edit").onclick = () => showCfg(true);

        const tick = async () => {
            if (!alive || busy || !token || !pid) return;
            busy = true;
            $("#_gl_meta").textContent = "polling…";
            try {
                const ep = base() + "/api/v4/projects/" + encodeURIComponent(pid) + "/pipelines?per_page=20&order_by=id&sort=desc";
                const r = await window.dyo.http(ep, { headers: { "PRIVATE-TOKEN": token }, timeout: 9000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_gl_sum").textContent = "—";
                    $("#_gl_list").innerHTML = `<span style="color:var(--danger)">${esc((r && r.error) || ("HTTP " + (r && r.status)))}</span>`;
                    $("#_gl_meta").textContent = "unavailable";
                    return;
                }
                let arr; try { arr = JSON.parse(r.text); } catch (e) { arr = null; }
                if (!Array.isArray(arr)) { $("#_gl_list").innerHTML = `<span style="color:var(--danger)">unexpected response</span>`; return; }
                if (!arr.length) { $("#_gl_sum").textContent = "no pipelines"; $("#_gl_list").innerHTML = ""; $("#_gl_meta").textContent = ""; return; }
                let ok = 0, fail = 0, run = 0;
                $("#_gl_list").innerHTML = arr.slice(0, 200).map(p => {
                    if (p.status === "success") ok++; else if (p.status === "failed") fail++;
                    else if (p.status === "running" || p.status === "pending") run++;
                    const c = col(p.status);
                    return `<div data-u="${esc(p.web_url || "")}" style="display:flex;gap:8px;padding:2px 2px;border-bottom:1px solid var(--border);${p.web_url ? "cursor:pointer" : ""}">
                        <span style="color:${c};width:70px;flex:0 0 auto">${esc(p.status || "")}</span>
                        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(p.ref || "")}">${esc(p.ref || "")}</span>
                        <span style="color:var(--text-dim);flex:0 0 auto">#${esc(String(p.id || ""))}</span>
                        <span style="color:var(--text-dim);flex:0 0 auto;width:34px;text-align:right">${esc(ago(p.updated_at || p.created_at))}</span>
                    </div>`;
                }).join("");
                body.querySelectorAll("#_gl_list [data-u]").forEach(el => {
                    const u = el.getAttribute("data-u"); if (u) el.onclick = () => window.dyo.openExternal(u);
                });
                $("#_gl_sum").innerHTML = `<span style="color:var(--accent2)">${ok}✓</span> <span style="color:var(--danger)">${fail}✗</span> <span style="color:var(--accent)">${run}◐</span>`;
                $("#_gl_meta").textContent = "updated " + new Date().toLocaleTimeString(window.I18N.locale());
            } catch (e) {
                if (alive) $("#_gl_list").innerHTML = `<span style="color:var(--danger)">${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };

        const iv = setInterval(tick, 15000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
