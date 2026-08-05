"use strict";
window.I18N.register({
    en: { "widget.ci_jenkins": "Jenkins", "cat.cicd": "CI/CD" },
    ru: { "widget.ci_jenkins": "Jenkins", "cat.cicd": "CI/CD" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.ci_jenkins = {
    id: "ci_jenkins",
    title: "widget.ci_jenkins",
    category: "cicd",
    description: "Jenkins jobs health from ball colors (green/red/building)",
    defaultSize: { w: 8, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div id="_jk_cfg" style="display:none;flex-direction:column;gap:6px">
              <input id="_jk_url" placeholder="https://jenkins.example.com" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <input id="_jk_user" placeholder="username" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <input id="_jk_token" type="password" placeholder="API token" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <button id="_jk_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px">Save</button>
            </div>
            <div id="_jk_main" style="display:none;flex-direction:column;gap:6px;height:100%">
              <div class="metric-row"><span class="k">🔧 Jobs</span><span class="v" id="_jk_sum">…</span></div>
              <div id="_jk_list" style="display:flex;flex-direction:column;gap:1px;overflow:auto;font-family:var(--font-mono);font-size:11.5px;flex:1"></div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto">
                <span id="_jk_meta" style="color:var(--text-dim);font-size:11px"></span>
                <button id="_jk_edit" title="Settings" aria-label="Settings" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">⚙</button>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        let url = "", user = "", token = "";
        const base = () => url.replace(/\/+$/, "");
        const showCfg = show => { $("#_jk_cfg").style.display = show ? "flex" : "none"; $("#_jk_main").style.display = show ? "none" : "flex"; };

        // Jenkins "color" maps: blue=ok, red=fail, yellow=unstable, *_anime=building, grey/disabled/aborted/notbuilt
        const ball = color => {
            const c = String(color || "");
            const building = /_anime$/.test(c);
            const b = c.replace(/_anime$/, "");
            let g = "●", cl = "var(--text)", t = b;
            if (b === "blue") { cl = "var(--accent2)"; t = "success"; }
            else if (b === "red") { cl = "var(--danger)"; t = "failed"; }
            else if (b === "yellow") { cl = "#d4b106"; t = "unstable"; }
            else if (b === "aborted" || b === "grey" || b === "disabled" || b === "notbuilt") { cl = "var(--text-dim)"; g = "○"; }
            if (building) { g = "◐"; cl = "var(--accent)"; t = (b || "") + " (building)"; }
            return { g, cl, t };
        };

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            url = (s && s["ci.jenkins.url"]) || "";
            user = (s && s["ci.jenkins.user"]) || "";
            token = (s && s["ci.jenkins.token"]) || "";
            $("#_jk_url").value = url; $("#_jk_user").value = user; $("#_jk_token").value = token;
            if (!url || !user || !token) showCfg(true); else { showCfg(false); tick(); }
        });

        $("#_jk_save").onclick = async () => {
            url = $("#_jk_url").value.trim();
            user = $("#_jk_user").value.trim();
            token = $("#_jk_token").value.trim();
            await window.dyo.settings.set({ "ci.jenkins.url": url, "ci.jenkins.user": user, "ci.jenkins.token": token });
            if (url && user && token) { showCfg(false); tick(); }
        };
        $("#_jk_edit").onclick = () => showCfg(true);

        const tick = async () => {
            if (!alive || busy || !url || !user || !token) return;
            busy = true;
            $("#_jk_meta").textContent = "polling…";
            try {
                const ep = base() + "/api/json?tree=jobs[name,color,url]";
                const auth = "Basic " + btoa(user + ":" + token);
                const r = await window.dyo.http(ep, { headers: { Authorization: auth }, timeout: 9000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_jk_sum").textContent = "—";
                    $("#_jk_list").innerHTML = `<span style="color:var(--danger)">${esc((r && r.error) || ("HTTP " + (r && r.status)))}</span>`;
                    $("#_jk_meta").textContent = "unavailable";
                    return;
                }
                let j; try { j = JSON.parse(r.text); } catch (e) { j = null; }
                const jobs = j && Array.isArray(j.jobs) ? j.jobs : null;
                if (!jobs) { $("#_jk_list").innerHTML = `<span style="color:var(--danger)">unexpected response</span>`; return; }
                if (!jobs.length) { $("#_jk_sum").textContent = "no jobs"; $("#_jk_list").innerHTML = ""; $("#_jk_meta").textContent = ""; return; }
                let ok = 0, fail = 0, build = 0;
                $("#_jk_list").innerHTML = jobs.slice(0, 200).map(job => {
                    const m = ball(job.color);
                    if (m.t === "success") ok++;
                    else if (m.t === "failed") fail++;
                    if (/building/.test(m.t)) build++;
                    return `<div data-u="${esc(job.url || "")}" style="display:flex;gap:8px;padding:2px 2px;border-bottom:1px solid var(--border);${job.url ? "cursor:pointer" : ""}">
                        <span style="color:${m.cl};flex:0 0 auto" title="${esc(m.t)}">${m.g}</span>
                        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(job.name || "")}">${esc(job.name || "")}</span>
                        <span style="color:var(--text-dim);flex:0 0 auto">${esc(m.t)}</span>
                    </div>`;
                }).join("");
                body.querySelectorAll("#_jk_list [data-u]").forEach(el => {
                    const u = el.getAttribute("data-u"); if (u) el.onclick = () => window.dyo.openExternal(u);
                });
                $("#_jk_sum").innerHTML = `<span style="color:var(--accent2)">${ok}✓</span> <span style="color:var(--danger)">${fail}✗</span> <span style="color:var(--accent)">${build}◐</span> / ${jobs.length}`;
                $("#_jk_meta").textContent = "updated " + new Date().toLocaleTimeString(window.I18N.locale());
            } catch (e) {
                if (alive) $("#_jk_list").innerHTML = `<span style="color:var(--danger)">${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };

        const iv = setInterval(tick, 15000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
