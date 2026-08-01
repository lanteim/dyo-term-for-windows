"use strict";
window.I18N.register({
    en: { "widget.api_openapi": "OpenAPI Endpoints", "cat.web": "Web" },
    ru: { "widget.api_openapi": "Эндпоинты OpenAPI", "cat.web": "Веб" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.api_openapi = {
    id: "api_openapi",
    title: "widget.api_openapi",
    category: "web",
    description: "Load an OpenAPI/Swagger JSON from URL or pasted text and list its endpoints",
    defaultSize: { w: 8, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const SKEY = "api.openapi.url";
        let alive = true, busy = false;
        const mcolors = { GET: "var(--accent)", POST: "var(--accent2)", PUT: "#e0a458", PATCH: "#e0a458", DELETE: "var(--danger)" };

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <span style="color:var(--accent);font-weight:600">openapi</span>
              <input id="_oa_url" placeholder="https://…/openapi.json" style="flex:1;min-width:160px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <button id="_oa_load" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 10px;cursor:pointer;font-family:var(--font-mono)">Load URL</button>
              <input id="_oa_filter" placeholder="filter…" style="width:110px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <span id="_oa_st" style="color:var(--text-dim);margin-left:auto"></span>
            </div>
            <details><summary style="cursor:pointer;color:var(--text-dim);font-size:11px">paste JSON instead</summary>
              <div style="display:flex;gap:6px;margin-top:4px">
                <textarea id="_oa_txt" placeholder='{"openapi":"3.0.0",...}' style="flex:1;height:56px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11px"></textarea>
                <button id="_oa_parse" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 10px;cursor:pointer;font-family:var(--font-mono)">Parse</button>
              </div>
            </details>
            <div class="metric-row"><span class="k" id="_oa_title">—</span><span class="v"><b id="_oa_cnt" style="color:var(--accent2)">0</b> ops</span></div>
            <div id="_oa_msg" style="color:var(--text-dim);font-size:11px"></div>
            <div id="_oa_list" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;font-family:var(--font-mono);font-size:11.5px"></div>
          </div>`;
        const $ = s => body.querySelector(s);
        let all = [];

        window.dyo.settings.get().then(s => { if (alive && s && s[SKEY]) $("#_oa_url").value = s[SKEY]; });

        const render = () => {
            const f = $("#_oa_filter").value.trim().toLowerCase();
            const rows = all.filter(r => !f || (r.method + " " + r.path + " " + (r.summary || "")).toLowerCase().includes(f));
            $("#_oa_cnt").textContent = String(all.length);
            if (!rows.length) { $("#_oa_list").innerHTML = `<div style="padding:10px;color:var(--text-dim)">No endpoints.</div>`; return; }
            $("#_oa_list").innerHTML = rows.slice(0, 200).map(r => {
                const c = mcolors[r.method] || "var(--text)";
                return `<div style="display:flex;gap:8px;padding:3px 8px;border-bottom:1px solid var(--border);white-space:nowrap"><span style="color:${c};font-weight:600;width:56px;display:inline-block">${esc(r.method)}</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis">${esc(r.path)}</span><span style="color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;max-width:40%">${esc(r.summary || "")}</span></div>`;
            }).join("");
        };

        const parse = (obj) => {
            all = [];
            const paths = obj && obj.paths || {};
            const methods = ["get", "post", "put", "patch", "delete", "head", "options"];
            Object.keys(paths).forEach(p => {
                const item = paths[p] || {};
                methods.forEach(m => { if (item[m]) all.push({ method: m.toUpperCase(), path: p, summary: item[m].summary || item[m].operationId || "" }); });
            });
            all.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
            const info = obj && obj.info || {};
            $("#_oa_title").textContent = (info.title || "API") + (info.version ? " v" + info.version : "");
            $("#_oa_msg").textContent = "";
            render();
        };

        $("#_oa_parse").onclick = () => {
            try { parse(JSON.parse($("#_oa_txt").value)); $("#_oa_st").textContent = "parsed"; }
            catch (e) { $("#_oa_msg").innerHTML = `<span style="color:var(--danger)">invalid JSON: ${esc(e && e.message)}</span>`; }
        };

        const load = async () => {
            if (busy) return; busy = true;
            const url = $("#_oa_url").value.trim();
            if (!/^https?:\/\//i.test(url)) { $("#_oa_msg").innerHTML = `<span style="color:var(--danger)">enter an http(s) URL</span>`; busy = false; return; }
            window.dyo.settings.set({ [SKEY]: url });
            $("#_oa_st").textContent = "loading…";
            try {
                const r = await window.dyo.http(url, { method: "GET", timeout: 15000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) { $("#_oa_msg").innerHTML = `<span style="color:var(--danger)">fetch failed: ${esc(r && (r.error || r.status))}</span> — check the URL is reachable & CORS-free.`; $("#_oa_st").textContent = "failed"; return; }
                parse(JSON.parse(r.text));
                $("#_oa_st").textContent = "loaded";
            } catch (e) { if (alive) $("#_oa_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`; }
            finally { busy = false; }
        };
        $("#_oa_load").onclick = load;
        $("#_oa_url").addEventListener("keydown", e => { if (e.key === "Enter") load(); });
        $("#_oa_filter").addEventListener("input", render);

        return { destroy: () => { alive = false; } };
    }
};
