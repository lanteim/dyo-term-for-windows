"use strict";
window.I18N.register({
    en: { "widget.de_minio": "MinIO Buckets", "cat.data": "Data" },
    ru: { "widget.de_minio": "Бакеты MinIO", "cat.data": "Данные" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.de_minio = {
    id: "de_minio",
    title: "widget.de_minio",
    category: "data",
    description: "MinIO/S3 buckets via the mc client (mc ls <alias>)",
    defaultSize: { w: 8, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const SKEY = "de.minio.alias";
        let alive = true, busy = false, alias = "local";

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <span style="color:var(--accent);font-weight:600">minio · mc</span>
              <input id="_mo_alias" placeholder="alias (local)" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px;width:120px"/>
              <button id="_mo_save" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 10px;cursor:pointer;font-family:var(--font-mono)">Save</button>
              <span id="_mo_st" style="color:var(--text-dim);margin-left:auto"></span>
            </div>
            <div class="metric-row"><span class="k">BUCKETS</span><span class="v"><b id="_mo_cnt" style="font-size:16px;color:var(--accent2)">—</b></span></div>
            <div id="_mo_msg" style="color:var(--text-dim);font-size:11px"></div>
            <div id="_mo_list" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;font-family:var(--font-mono);font-size:11.5px"></div>
          </div>`;
        const $ = s => body.querySelector(s);

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            if (s && s[SKEY]) alias = s[SKEY];
            $("#_mo_alias").value = alias;
            tick();
        });

        $("#_mo_save").onclick = async () => {
            alias = $("#_mo_alias").value.trim() || "local";
            await window.dyo.settings.set({ [SKEY]: alias });
            tick();
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            $("#_mo_st").textContent = "polling…";
            try {
                const r = await window.dyo.exec("mc", ["ls", "--json", alias], { cwd: window.term ? window.term.lastCwd : undefined, timeout: 15000 });
                if (!alive) return;
                if (!r || r.code !== 0) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n")[0] : "mc not found";
                    $("#_mo_cnt").textContent = "—"; $("#_mo_list").innerHTML = "";
                    $("#_mo_msg").innerHTML = `<span style="color:var(--danger)">${esc(err)}</span> — install MinIO Client (mc) and set an alias with <code>mc alias set</code>.`;
                    $("#_mo_st").textContent = "unavailable";
                    return;
                }
                const buckets = [];
                r.stdout.split("\n").map(l => l.trim()).filter(Boolean).forEach(line => {
                    try {
                        const o = JSON.parse(line);
                        if (o && (o.type === "folder" || o.key)) {
                            const name = (o.key || "").replace(/\/$/, "");
                            if (name) buckets.push({ name, size: o.size, date: o.lastModified });
                        }
                    } catch (e) { /* skip non-json lines */ }
                });
                $("#_mo_msg").textContent = "";
                $("#_mo_cnt").textContent = String(buckets.length);
                if (!buckets.length) $("#_mo_list").innerHTML = `<div style="padding:10px;color:var(--text-dim)">No buckets on "${esc(alias)}".</div>`;
                else $("#_mo_list").innerHTML = buckets.slice(0, 200).map(b => {
                    const dt = b.date ? String(b.date).slice(0, 10) : "";
                    return `<div style="display:flex;gap:8px;padding:3px 8px;border-bottom:1px solid var(--border);white-space:nowrap">🪣 <span style="flex:1;overflow:hidden;text-overflow:ellipsis">${esc(b.name)}</span><span style="color:var(--text-dim)">${esc(dt)}</span></div>`;
                }).join("");
                $("#_mo_st").textContent = "updated " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) $("#_mo_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };

        const iv = setInterval(tick, 20000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
