"use strict";
window.I18N.register({
    en: { "widget.ct_colima": "Colima", "cat.docker": "Docker" },
    ru: { "widget.ct_colima": "Colima", "cat.docker": "Docker" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.ct_colima = {
        id: "ct_colima",
        title: "widget.ct_colima",
        category: "docker",
        description: "Colima VM status",
        defaultSize: { w: 5, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🐳 COLIMA</span>
                    <span id="_ctcl_sum" style="margin-left:auto"></span>
                  </div>
                  <div id="_ctcl_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:4px"><div style="color:var(--text-dim);padding:10px">Loading…</div></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const diagnose = (res) => {
                const err = ((res && (res.stderr || "")) || "").toLowerCase();
                if (!res || res.code === 127 || err.includes("not found") || err.includes("command not found")) return "colima CLI not installed";
                if (err.includes("not running") || err.includes("no instance")) return null; // handled as stopped
                return "colima not available";
            };

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    // colima list --json emits one JSON object per line per profile
                    const res = await window.dyo.exec("colima", ["list", "--json"], { timeout: 8000 });
                    if (!res || (res.code !== 0 && !(res.stdout || "").trim())) {
                        const msg = diagnose(res);
                        if (msg === null) {
                            $("#_ctcl_sum").innerHTML = `<span style="color:var(--danger)">stopped</span>`;
                            $("#_ctcl_body").innerHTML = `<div style="color:var(--text-dim);padding:10px">no running instance · start with <code>colima start</code></div>`;
                        } else {
                            $("#_ctcl_sum").textContent = "";
                            $("#_ctcl_body").innerHTML = `<div style="color:var(--text-dim);padding:10px">${esc(msg)}</div>`;
                        }
                        return;
                    }
                    const insts = [];
                    (res.stdout || "").split("\n").forEach(l => {
                        l = l.trim();
                        if (!l) return;
                        try { insts.push(JSON.parse(l)); } catch (e) { }
                    });
                    if (!insts.length) {
                        $("#_ctcl_sum").innerHTML = `<span style="color:var(--danger)">stopped</span>`;
                        $("#_ctcl_body").innerHTML = `<div style="color:var(--text-dim);padding:10px">no instances</div>`;
                        return;
                    }
                    const anyRun = insts.some(i => /running/i.test(i.status || ""));
                    $("#_ctcl_sum").innerHTML = anyRun ? `<span style="color:var(--accent2)">running</span>` : `<span style="color:var(--danger)">stopped</span>`;
                    let html = "";
                    insts.forEach(i => {
                        const run = /running/i.test(i.status || "");
                        html += `<div style="margin-bottom:6px">
                          <div class="metric-row"><span class="k" style="color:var(--text)">${esc(i.name || "default")}</span><span class="v" style="color:${run ? "var(--accent2)" : "var(--text-dim)"}">${esc(i.status || "?")}</span></div>
                          <div class="metric-row"><span class="k">arch</span><span class="v">${esc(i.arch || "?")}</span></div>
                          <div class="metric-row"><span class="k">runtime</span><span class="v">${esc(i.runtime || "?")}</span></div>
                          <div class="metric-row"><span class="k">cpu / mem / disk</span><span class="v">${esc(i.cpus || "?")}c · ${esc(fmtB(i.memory))} · ${esc(fmtB(i.disk))}</span></div>
                        </div>`;
                    });
                    $("#_ctcl_body").innerHTML = html;
                } catch (e) {
                    $("#_ctcl_sum").textContent = "error";
                } finally { busy = false; }
            };
            const fmtB = (n) => {
                n = Number(n);
                if (!n || isNaN(n)) return "?";
                const g = n / (1024 * 1024 * 1024);
                return g >= 1 ? g.toFixed(1) + "G" : Math.round(n / (1024 * 1024)) + "M";
            };
            tick();
            const iv = setInterval(tick, 6000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
