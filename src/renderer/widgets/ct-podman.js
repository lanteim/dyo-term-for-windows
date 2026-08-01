"use strict";
window.I18N.register({
    en: { "widget.ct_podman": "Podman", "cat.docker": "Docker" },
    ru: { "widget.ct_podman": "Podman", "cat.docker": "Docker" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.ct_podman = {
        id: "ct_podman",
        title: "widget.ct_podman",
        category: "docker",
        description: "Podman containers & image count",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🦭 PODMAN</span>
                    <span id="_ctpm_sum" style="color:var(--text-dim);margin-left:auto;font-variant-numeric:tabular-nums"></span>
                  </div>
                  <div id="_ctpm_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:2px"></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const diagnose = (res) => {
                const err = ((res && (res.stderr || "")) || "").toLowerCase();
                if (!res || res.code === 127 || err.includes("not found") || err.includes("command not found")) return "podman CLI not installed";
                if (err.includes("cannot connect") || err.includes("unable to connect") || err.includes("no such file")) return "podman machine not running";
                return "podman not available";
            };

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const [ps, imgs] = await Promise.all([
                        window.dyo.exec("podman", ["ps", "-a", "--format", "{{.Names}}\t{{.Image}}\t{{.Status}}"], { timeout: 8000 }),
                        window.dyo.exec("podman", ["images", "-q"], { timeout: 8000 })
                    ]);
                    if (!ps || ps.code !== 0) {
                        $("#_ctpm_sum").textContent = "";
                        $("#_ctpm_body").innerHTML = `<div style="color:var(--text-dim);padding:10px">${esc(diagnose(ps))}</div>`;
                        return;
                    }
                    const rows = ps.stdout.split("\n").filter(l => l.trim()).map(l => {
                        const p = l.split("\t");
                        return { name: p[0] || "", image: p[1] || "", status: p[2] || "" };
                    });
                    const up = rows.filter(r => /^up|running/i.test(r.status)).length;
                    const imgCount = imgs && imgs.code === 0 ? imgs.stdout.split("\n").filter(x => x.trim()).length : 0;
                    $("#_ctpm_sum").textContent = `${up}/${rows.length} up · ${imgCount} img`;

                    if (!rows.length) {
                        $("#_ctpm_body").innerHTML = `<div style="color:var(--text-dim);padding:10px">no containers</div>`;
                        return;
                    }
                    let html = "";
                    rows.slice(0, 200).forEach(r => {
                        const running = /^up|running/i.test(r.status);
                        html += `<div class="metric-row" style="padding:2px 8px">
                          <span class="k" style="color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)} <span style="color:var(--text-dim)">${esc(r.image)}</span></span>
                          <span class="v" style="color:${running ? "var(--accent2)" : "var(--text-dim)"}">${esc(r.status)}</span></div>`;
                    });
                    $("#_ctpm_body").innerHTML = html;
                } catch (e) {
                    $("#_ctpm_sum").textContent = "error";
                } finally { busy = false; }
            };
            tick();
            const iv = setInterval(tick, 5000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
