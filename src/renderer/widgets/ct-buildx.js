"use strict";
window.I18N.register({
    en: { "widget.ct_buildx": "Buildx Builders", "cat.docker": "Docker" },
    ru: { "widget.ct_buildx": "Buildx Сборщики", "cat.docker": "Docker" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.ct_buildx = {
        id: "ct_buildx",
        title: "widget.ct_buildx",
        category: "docker",
        description: "docker buildx builder instances",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🧱 BUILDX</span>
                    <span id="_ctbx_sum" style="color:var(--text-dim);margin-left:auto;font-variant-numeric:tabular-nums"></span>
                  </div>
                  <div id="_ctbx_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:2px"></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const diagnose = (res) => {
                const err = ((res && (res.stderr || "")) || "").toLowerCase();
                if (!res || res.code === 127 || err.includes("not a docker command") || err.includes("not found") || err.includes("command not found")) return "docker buildx not available";
                if (err.includes("cannot connect") || err.includes("daemon")) return "docker daemon not running";
                return "buildx not available";
            };

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const res = await window.dyo.exec("docker", ["buildx", "ls"], { timeout: 8000 });
                    if (!res || res.code !== 0) {
                        $("#_ctbx_sum").textContent = "";
                        $("#_ctbx_body").innerHTML = `<div style="color:var(--text-dim);padding:10px">${esc(diagnose(res))}</div>`;
                        return;
                    }
                    // Parse tabular output. Builder header rows have no leading whitespace; node rows are indented.
                    const lines = (res.stdout || "").split("\n");
                    if (lines.length && /^NAME\/NODE/i.test(lines[0])) lines.shift();
                    const builders = [];
                    lines.forEach(raw => {
                        if (!raw.trim()) return;
                        const indented = /^\s/.test(raw);
                        const cols = raw.trim().split(/\s{2,}/);
                        let name = cols[0] || "";
                        const isDefault = /\*$/.test(name);
                        name = name.replace(/\*$/, "").trim();
                        if (!indented) {
                            builders.push({ name, driver: cols[1] || "", status: cols[2] || "", def: isDefault, nodes: [] });
                        } else if (builders.length) {
                            builders[builders.length - 1].nodes.push({ name, status: cols[2] || cols[1] || "" });
                        }
                    });
                    $("#_ctbx_sum").textContent = `${builders.length} builder${builders.length === 1 ? "" : "s"}`;
                    if (!builders.length) {
                        $("#_ctbx_body").innerHTML = `<div style="color:var(--text-dim);padding:10px">no builders</div>`;
                        return;
                    }
                    let html = "";
                    builders.slice(0, 100).forEach(b => {
                        const run = /running|active|inactive/i.test(b.status);
                        const ok = /running/i.test(b.status);
                        html += `<div class="metric-row" style="padding:2px 8px">
                          <span class="k" style="color:var(--text)">${b.def ? "★ " : ""}${esc(b.name)} <span style="color:var(--text-dim)">${esc(b.driver)}</span></span>
                          <span class="v" style="color:${ok ? "var(--accent2)" : (run ? "var(--text-dim)" : "var(--danger)")}">${esc(b.status || "?")}</span></div>`;
                    });
                    $("#_ctbx_body").innerHTML = html;
                } catch (e) {
                    $("#_ctbx_sum").textContent = "error";
                } finally { busy = false; }
            };
            tick();
            const iv = setInterval(tick, 6000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
