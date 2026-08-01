"use strict";
window.I18N.register({
    en: { "widget.info_shell": "Shell & Runtime", "cat.system": "System" },
    ru: { "widget.info_shell": "Оболочка", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.info_shell = {
        id: "info_shell",
        title: "widget.info_shell",
        category: "system",
        description: "Login shell, $TERM and app runtime versions",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🐚 SHELL</span>
                    <b class="_shell" style="color:var(--accent);font-family:var(--font-mono);cursor:pointer" title="Click to copy">—</b>
                    <span class="_msg" style="color:var(--text-dim);margin-left:auto;font-size:11px"></span>
                  </div>
                  <div class="metric-row"><span class="k">TERM</span><span class="v _term" style="font-family:var(--font-mono)">—</span></div>
                  <div class="metric-row"><span class="k">PLATFORM</span><span class="v _plat" style="font-family:var(--font-mono)">—</span></div>
                  <div class="metric-row"><span class="k">ELECTRON</span><span class="v _el" style="font-family:var(--font-mono)">—</span></div>
                  <div class="metric-row"><span class="k">NODE</span><span class="v _node" style="font-family:var(--font-mono)">—</span></div>
                  <div class="metric-row"><span class="k">CHROME</span><span class="v _chr" style="font-family:var(--font-mono)">—</span></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            $("._shell").onclick = () => { const t = $("._shell").textContent.trim(); if (t && t !== "—") navigator.clipboard.writeText(t).catch(() => {}); };

            const getEnv = async (name) => {
                try { const r = await window.dyo.exec("printenv", [name], { timeout: 5000 }); return r && r.stdout ? r.stdout.trim() : ""; }
                catch (e) { return ""; }
            };

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const [shell, term, info] = await Promise.all([getEnv("SHELL"), getEnv("TERM"), window.dyo.appInfo()]);
                    if (!alive) return;
                    $("._shell").textContent = shell || "—";
                    $("._term").textContent = term || "—";
                    if (info) {
                        $("._plat").textContent = (info.platform || "—") + (info.arch ? " / " + info.arch : "");
                        $("._el").textContent = info.electron || "—";
                        $("._node").textContent = info.node || "—";
                        $("._chr").textContent = info.chrome || "—";
                    }
                    $("._msg").textContent = "";
                } catch (e) { if (alive) $("._msg").textContent = "error"; } finally { busy = false; }
            };
            tick();
            const iv = setInterval(tick, 60000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
