"use strict";
window.I18N.register({
    en: { "widget.ci_circleci": "CircleCI", "cat.cicd": "CI/CD" },
    ru: { "widget.ci_circleci": "CircleCI", "cat.cicd": "CI/CD" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.ci_circleci = {
    id: "ci_circleci",
    title: "widget.ci_circleci",
    category: "cicd",
    description: "CircleCI recent pipelines for a project slug",
    defaultSize: { w: 8, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div id="_cc_cfg" style="display:none;flex-direction:column;gap:6px">
              <input id="_cc_token" type="password" placeholder="CircleCI API token" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <input id="_cc_slug" placeholder="Project slug: gh/org/repo" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <button id="_cc_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px">Save</button>
            </div>
            <div id="_cc_main" style="display:none;flex-direction:column;gap:6px;height:100%">
              <div class="metric-row"><span class="k">⊙ Pipelines</span><span class="v" id="_cc_sum">…</span></div>
              <div id="_cc_list" style="display:flex;flex-direction:column;gap:1px;overflow:auto;font-family:var(--font-mono);font-size:11.5px;flex:1"></div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto">
                <span id="_cc_meta" style="color:var(--text-dim);font-size:11px"></span>
                <button id="_cc_edit" title="Settings" aria-label="Settings" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">⚙</button>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        let token = "", slug = "";
        const showCfg = show => { $("#_cc_cfg").style.display = show ? "flex" : "none"; $("#_cc_main").style.display = show ? "none" : "flex"; };

        const col = st => {
            if (st === "success") return "var(--accent2)";
            if (st === "failed" || st === "failing" || st === "error" || st === "canceled") return "var(--danger)";
            if (st === "running" || st === "on_hold" || st === "created" || st === "pending") return "var(--accent)";
            if (st === "not_run" || st === "skipped" || st === "blocked" || st === "unauthorized") return "var(--text-dim)";
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
            token = (s && s["ci.circleci.token"]) || "";
            slug = (s && s["ci.circleci.slug"]) || "";
            $("#_cc_token").value = token; $("#_cc_slug").value = slug;
            if (!token || !slug) showCfg(true); else { showCfg(false); tick(); }
        });

        $("#_cc_save").onclick = async () => {
            token = $("#_cc_token").value.trim();
            slug = $("#_cc_slug").value.trim().replace(/^\/+|\/+$/g, "");
            await window.dyo.settings.set({ "ci.circleci.token": token, "ci.circleci.slug": slug });
            if (token && slug) { showCfg(false); tick(); }
        };
        $("#_cc_edit").onclick = () => showCfg(true);

        // Fetch pipeline list, then per-pipeline latest workflow status (best effort, capped).
        const wfStatus = async (pipelineId) => {
            try {
                const r = await window.dyo.http("https://circleci.com/api/v2/pipeline/" + encodeURIComponent(pipelineId) + "/workflow", { headers: { "Circle-Token": token }, timeout: 8000 });
                if (!r || r.error || !r.ok) return null;
                const j = JSON.parse(r.text);
                const w = j && Array.isArray(j.items) && j.items[0];
                return w ? { status: w.status, name: w.name } : null;
            } catch (e) { return null; }
        };

        const tick = async () => {
            if (!alive || busy || !token || !slug) return;
            busy = true;
            $("#_cc_meta").textContent = "polling…";
            try {
                const ep = "https://circleci.com/api/v2/project/" + slug.split("/").map(encodeURIComponent).join("/") + "/pipeline";
                const r = await window.dyo.http(ep, { headers: { "Circle-Token": token }, timeout: 9000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_cc_sum").textContent = "—";
                    $("#_cc_list").innerHTML = `<span style="color:var(--danger)">${esc((r && r.error) || ("HTTP " + (r && r.status)))}</span>`;
                    $("#_cc_meta").textContent = "unavailable";
                    return;
                }
                let j; try { j = JSON.parse(r.text); } catch (e) { j = null; }
                const items = j && Array.isArray(j.items) ? j.items : null;
                if (!items) { $("#_cc_list").innerHTML = `<span style="color:var(--danger)">unexpected response</span>`; return; }
                if (!items.length) { $("#_cc_sum").textContent = "no pipelines"; $("#_cc_list").innerHTML = ""; $("#_cc_meta").textContent = ""; return; }
                const top = items.slice(0, 12);
                const statuses = await Promise.all(top.map(p => wfStatus(p.id)));
                if (!alive) return;
                let ok = 0, fail = 0, run = 0;
                $("#_cc_list").innerHTML = top.map((p, i) => {
                    const w = statuses[i];
                    const st = w ? w.status : "?";
                    if (st === "success") ok++;
                    else if (st === "failed" || st === "error" || st === "canceled") fail++;
                    else if (st === "running" || st === "on_hold") run++;
                    const c = col(st);
                    const ref = (p.vcs && (p.vcs.branch || (p.vcs.tag ? "tag:" + p.vcs.tag : ""))) || "";
                    const num = p.number != null ? "#" + p.number : "";
                    return `<div style="display:flex;gap:8px;padding:2px 2px;border-bottom:1px solid var(--border)">
                        <span style="color:${c};width:64px;flex:0 0 auto">${esc(st)}</span>
                        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(ref)}">${esc(ref)}</span>
                        <span style="color:var(--text-dim);flex:0 0 auto">${esc(num)}</span>
                        <span style="color:var(--text-dim);flex:0 0 auto;width:34px;text-align:right">${esc(ago(p.updated_at || p.created_at))}</span>
                    </div>`;
                }).join("");
                $("#_cc_sum").innerHTML = `<span style="color:var(--accent2)">${ok}✓</span> <span style="color:var(--danger)">${fail}✗</span> <span style="color:var(--accent)">${run}◐</span>`;
                $("#_cc_meta").textContent = "updated " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) $("#_cc_list").innerHTML = `<span style="color:var(--danger)">${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };

        const iv = setInterval(tick, 20000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
