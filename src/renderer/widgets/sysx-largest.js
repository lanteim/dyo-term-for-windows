"use strict";
window.I18N.register({
    en: { "widget.sysx_largest": "Largest Files", "cat.system": "System" },
    ru: { "widget.sysx_largest": "Крупные файлы", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    const toBytes = s => {
        const m = /^([\d]+(?:[.,]\d+)?)\s*([KMGTP]?)i?B?$/i.exec(s.trim());
        if (!m) return 0;
        const n = parseFloat(m[1].replace(",", ".")) || 0;
        const u = (m[2] || "").toUpperCase();
        const mult = { "": 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4, P: 1024 ** 5 }[u] || 1;
        return n * mult;
    };

    window.WIDGETS.sysx_largest = {
        id: "sysx_largest",
        title: "widget.sysx_largest",
        category: "system",
        description: "largest files/dirs under cwd",
        defaultSize: { w: 6, h: 4 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🔎 LARGEST (du -ah)</span>
                    <button id="_sxl_scan" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-family:var(--font-mono);cursor:pointer;margin-left:auto">scan</button>
                  </div>
                  <div id="_sxl_note" style="color:var(--text-dim);font-size:11px">may be slow on big trees (12s cap). Click scan.</div>
                  <div id="_sxl_body" style="flex:1;overflow:auto;font-family:var(--font-mono);font-size:11px"></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const scan = async () => {
                if (!alive || busy) return;
                busy = true;
                $("#_sxl_note").textContent = "scanning…";
                $("#_sxl_scan").disabled = true;
                try {
                    const cwd = window.term && window.term.lastCwd;
                    const res = await window.dyo.exec("du", ["-ah", "."], { cwd, timeout: 12000 });
                    if (!res || (res.code !== 0 && !res.stdout)) {
                        $("#_sxl_note").textContent = (res && res.stderr) ? res.stderr.split("\n")[0] : "du unavailable";
                        $("#_sxl_body").innerHTML = "";
                        return;
                    }
                    let rows = (res.stdout || "").split("\n").filter(l => l.trim()).map(l => {
                        const idx = l.search(/\s/);
                        const size = l.slice(0, idx).trim();
                        const path = l.slice(idx).trim();
                        return { size, path, bytes: toBytes(size) };
                    }).filter(r => r.path && r.path !== "." && r.path !== "./");
                    rows.sort((a, b) => b.bytes - a.bytes);
                    rows = rows.slice(0, 15);
                    const partial = (res.code !== 0) ? " (partial — timed out)" : "";
                    $("#_sxl_note").textContent = "top " + rows.length + " by size" + partial;
                    if (!rows.length) { $("#_sxl_body").innerHTML = `<div style="color:var(--text-dim)">nothing found</div>`; return; }
                    const max = rows[0].bytes || 1;
                    let html = "";
                    rows.forEach(r => {
                        const name = r.path.replace(/^\.\//, "");
                        const pct = Math.max(2, Math.round((r.bytes / max) * 100));
                        html += `<div style="padding:2px 0">`
                            + `<div style="display:flex;gap:8px"><span style="color:var(--accent);width:64px;text-align:right">${esc(r.size)}</span>`
                            + `<span style="color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(name)}">${esc(name)}</span></div>`
                            + `<div class="bar"><i style="width:${pct}%"></i></div></div>`;
                    });
                    $("#_sxl_body").innerHTML = html;
                } catch (e) {
                    $("#_sxl_note").textContent = "error";
                } finally { busy = false; if (alive) $("#_sxl_scan").disabled = false; }
            };
            $("#_sxl_scan").addEventListener("click", scan);
            return { destroy: () => { alive = false; } };
        }
    };
})();
