"use strict";
window.I18N.register({
    en: { "widget.de_dbt": "dbt Run Results", "cat.data": "Data" },
    ru: { "widget.de_dbt": "Результаты dbt", "cat.data": "Данные" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.de_dbt = {
    id: "de_dbt",
    title: "widget.de_dbt",
    category: "data",
    description: "dbt model count & last run status from target/run_results.json",
    defaultSize: { w: 8, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <span style="color:var(--accent);font-weight:600">dbt</span>
              <button id="_dbt_ref" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 10px;cursor:pointer;font-family:var(--font-mono)">Refresh</button>
              <button id="_dbt_ls" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 10px;cursor:pointer;font-family:var(--font-mono)">dbt ls</button>
              <span id="_dbt_st" style="color:var(--text-dim);margin-left:auto"></span>
            </div>
            <div style="display:flex;gap:14px;flex-wrap:wrap">
              <div class="metric-row"><span class="k">MODELS</span><span class="v"><b id="_dbt_models" style="font-size:16px;color:var(--accent2)">—</b></span></div>
              <span style="color:#3fb950">✓ <b id="_dbt_ok">0</b></span>
              <span style="color:#d29922">↷ <b id="_dbt_skip">0</b></span>
              <span style="color:var(--danger)">✗ <b id="_dbt_err">0</b></span>
            </div>
            <div id="_dbt_msg" style="color:var(--text-dim);font-size:11px"></div>
            <div id="_dbt_list" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;font-family:var(--font-mono);font-size:11px"></div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const cwd = () => (window.term ? window.term.lastCwd : undefined);
        const join = (d, f) => (d.endsWith("/") ? d : d + "/") + f;
        const stCol = st => /^(success|pass)$/i.test(st) ? "#3fb950" : /^(error|fail)$/i.test(st) ? "var(--danger)" : "#d29922";

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            $("#_dbt_st").textContent = "reading…";
            try {
                const dir = cwd();
                if (!dir) { $("#_dbt_msg").textContent = "No working directory."; busy = false; $("#_dbt_st").textContent = ""; return; }
                const path = join(dir, "target/run_results.json");
                const r = await window.dyo.fs.read(path, 4000000);
                if (!alive) return;
                if (!r || r.error || typeof r.content !== "string") {
                    $("#_dbt_models").textContent = "—"; $("#_dbt_ok").textContent = "0"; $("#_dbt_skip").textContent = "0"; $("#_dbt_err").textContent = "0";
                    $("#_dbt_list").innerHTML = "";
                    $("#_dbt_msg").innerHTML = `No <code>target/run_results.json</code> in this dir. Run <code>dbt run</code> first, or use "dbt ls" to list models.`;
                    $("#_dbt_st").textContent = "no artifact";
                    return;
                }
                let j; try { j = JSON.parse(r.content); } catch (e) { j = null; }
                const results = j && Array.isArray(j.results) ? j.results : [];
                let models = 0, ok = 0, skip = 0, err = 0;
                results.forEach(res => {
                    const uid = res.unique_id || "";
                    if (uid.indexOf("model.") === 0) models++;
                    const st = (res.status || "").toLowerCase();
                    if (st === "success" || st === "pass") ok++;
                    else if (st === "error" || st === "fail" || st === "runtime error") err++;
                    else skip++;
                });
                $("#_dbt_models").textContent = String(models);
                $("#_dbt_ok").textContent = String(ok); $("#_dbt_skip").textContent = String(skip); $("#_dbt_err").textContent = String(err);
                $("#_dbt_msg").textContent = "";
                if (!results.length) $("#_dbt_list").innerHTML = `<div style="padding:8px;color:var(--text-dim)">Empty results.</div>`;
                else $("#_dbt_list").innerHTML = results.slice(0, 200).map(res => {
                    const uid = (res.unique_id || "").split(".").slice(1).join(".") || res.unique_id || "?";
                    const et = (res.execution_time != null) ? Number(res.execution_time).toFixed(2) + "s" : "";
                    return `<div style="display:flex;gap:8px;padding:3px 8px;border-bottom:1px solid var(--border);white-space:nowrap"><span style="color:${stCol(res.status)}">●</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis">${esc(uid)}</span><span style="color:var(--text-dim);width:56px;text-align:right">${esc(et)}</span></div>`;
                }).join("");
                $("#_dbt_st").textContent = "loaded " + new Date().toLocaleTimeString(window.I18N.locale());
            } catch (e) {
                if (alive) $("#_dbt_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };

        $("#_dbt_ref").onclick = tick;
        $("#_dbt_ls").onclick = () => { if (window.term && window.term.runInFocused) window.term.runInFocused("dbt ls\n"); };
        tick();
        const iv = setInterval(tick, 15000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
