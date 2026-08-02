"use strict";
window.I18N.register({
    en: { "widget.sysx_du": "Dir Disk Usage", "cat.system": "System" },
    ru: { "widget.sysx_du": "Размер папок", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    // parse human size like "1.2G", "512K", "4.0K", "2M", "512B" -> bytes
    const toBytes = s => {
        const m = /^([\d]+(?:[.,]\d+)?)\s*([KMGTP]?)i?B?$/i.exec(s.trim());
        if (!m) return 0;
        const n = parseFloat(m[1].replace(",", ".")) || 0;
        const u = (m[2] || "").toUpperCase();
        const mult = { "": 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4, P: 1024 ** 5 }[u] || 1;
        return n * mult;
    };

    window.WIDGETS.sysx_du = {
        id: "sysx_du",
        title: "widget.sysx_du",
        category: "system",
        description: "top subdirectories by size in cwd",
        defaultSize: { w: 6, h: 4 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">📁 DU -sh */</span>
                    <span id="_sxd_msg" style="color:var(--text-dim);margin-left:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%"></span>
                  </div>
                  <div id="_sxd_body" style="flex:1;overflow:auto;font-family:var(--font-mono);font-size:11px"></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const cwd = window.term && window.term.lastCwd;
                    $("#_sxd_msg").textContent = cwd ? cwd : "";
                    // du -sh */ needs shell glob; pass explicit dir list not available, so use argv "*/" won't expand.
                    // Use du -sh with depth via -d 1 on cwd itself, then filter to subdirs.
                    const res = await window.dyo.exec("du", ["-h", "-d", "1", "."], { cwd, timeout: 10000 });
                    if (!res || res.code !== 0 || !res.stdout) {
                        $("#_sxd_body").innerHTML = `<div style="color:var(--text-dim)">${esc((res && res.stderr) ? res.stderr.split("\n")[0] : "du unavailable")}</div>`;
                        return;
                    }
                    let rows = res.stdout.split("\n").filter(l => l.trim()).map(l => {
                        const idx = l.search(/\s/);
                        const size = l.slice(0, idx).trim();
                        const path = l.slice(idx).trim();
                        return { size, path, bytes: toBytes(size) };
                    }).filter(r => r.path && r.path !== "." && r.path !== "./");
                    rows.sort((a, b) => b.bytes - a.bytes);
                    rows = rows.slice(0, 15);
                    if (!rows.length) { $("#_sxd_body").innerHTML = `<div style="color:var(--text-dim)">no subdirectories</div>`; return; }
                    const max = rows[0].bytes || 1;
                    let html = "";
                    rows.forEach(r => {
                        const name = r.path.replace(/^\.\//, "");
                        const pct = Math.max(2, Math.round((r.bytes / max) * 100));
                        html += `<div style="padding:2px 0">`
                            + `<div style="display:flex;gap:8px"><span style="color:var(--accent);width:64px;text-align:right">${esc(r.size)}</span>`
                            + `<span style="color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</span></div>`
                            + `<div class="bar"><i style="width:${pct}%"></i></div></div>`;
                    });
                    $("#_sxd_body").innerHTML = html;
                } catch (e) {
                    $("#_sxd_body").innerHTML = `<div style="color:var(--text-dim)">error</div>`;
                } finally { busy = false; }
            };
            tick();
            const iv = setInterval(tick, 8000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
