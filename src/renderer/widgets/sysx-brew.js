"use strict";
window.I18N.register({
    en: { "widget.sysx_brew": "Brew Outdated", "cat.system": "System" },
    ru: { "widget.sysx_brew": "Brew обновления", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.sysx_brew = {
        id: "sysx_brew",
        title: "widget.sysx_brew",
        category: "system",
        description: "homebrew outdated packages",
        defaultSize: { w: 6, h: 4 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🍺 BREW OUTDATED</span>
                    <button id="_sxb_ref" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-family:var(--font-mono);cursor:pointer;margin-left:auto">refresh</button>
                  </div>
                  <div class="metric-row"><span class="k">OUTDATED</span><span class="v"><b id="_sxb_count">—</b></span></div>
                  <div id="_sxb_body" style="flex:1;overflow:auto;font-family:var(--font-mono);font-size:11px;margin-top:4px"></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                $("#_sxb_ref").disabled = true;
                try {
                    const res = await window.dyo.exec("brew", ["outdated", "--quiet"], { timeout: 20000 });
                    if (!res || (res.code === 127) || ((res.stderr || "").toLowerCase().includes("not found"))) {
                        $("#_sxb_count").textContent = "—";
                        $("#_sxb_body").innerHTML = `<div style="color:var(--text-dim)">homebrew not installed</div>`;
                        return;
                    }
                    if (res.code !== 0 && !res.stdout) {
                        $("#_sxb_count").textContent = "—";
                        $("#_sxb_body").innerHTML = `<div style="color:var(--text-dim)">${esc((res.stderr || "brew error").split("\n")[0])}</div>`;
                        return;
                    }
                    const pkgs = (res.stdout || "").split("\n").map(l => l.trim()).filter(Boolean);
                    $("#_sxb_count").textContent = pkgs.length;
                    $("#_sxb_count").style.color = pkgs.length ? "var(--accent2)" : "var(--accent)";
                    if (!pkgs.length) { $("#_sxb_body").innerHTML = `<div style="color:var(--text-dim)">everything up to date ✓</div>`; return; }
                    let html = "";
                    pkgs.slice(0, 80).forEach(p => {
                        html += `<div style="padding:1px 0;border-top:1px solid var(--border);color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p)}</div>`;
                    });
                    $("#_sxb_body").innerHTML = html;
                } catch (e) {
                    $("#_sxb_body").innerHTML = `<div style="color:var(--text-dim)">error</div>`;
                } finally { busy = false; if (alive) $("#_sxb_ref").disabled = false; }
            };
            $("#_sxb_ref").addEventListener("click", tick);
            tick();
            const iv = setInterval(tick, 300000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
