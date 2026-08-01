"use strict";
window.I18N.register({
    en: { "widget.info_os": "OS Info", "cat.system": "System" },
    ru: { "widget.info_os": "ОС", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.info_os = {
        id: "info_os",
        title: "widget.info_os",
        category: "system",
        description: "Operating system: distro, release, kernel, arch",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🖥️ OS</span>
                    <b class="_ttl" style="color:var(--accent)">—</b>
                    <span class="_msg" style="color:var(--text-dim);margin-left:auto;font-size:11px"></span>
                  </div>
                  <div class="metric-row"><span class="k">DISTRO</span><span class="v _distro" style="font-family:var(--font-mono);cursor:pointer" title="Click to copy">—</span></div>
                  <div class="metric-row"><span class="k">RELEASE</span><span class="v _release" style="font-family:var(--font-mono)">—</span></div>
                  <div class="metric-row"><span class="k">CODENAME</span><span class="v _code" style="font-family:var(--font-mono)">—</span></div>
                  <div class="metric-row"><span class="k">KERNEL</span><span class="v _kernel" style="font-family:var(--font-mono)">—</span></div>
                  <div class="metric-row"><span class="k">ARCH</span><span class="v _arch" style="font-family:var(--font-mono)">—</span></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            $("._distro").onclick = () => { const t = $("._distro").textContent.trim(); if (t && t !== "—") navigator.clipboard.writeText(t).catch(() => {}); };

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const d = await window.dyo.si("osInfo");
                    if (!alive) return;
                    if (!d || d.error) {
                        $("._msg").textContent = "unavailable";
                        return;
                    }
                    const distro = d.distro || d.platform || "—";
                    $("._ttl").textContent = distro;
                    $("._distro").textContent = distro;
                    $("._release").textContent = d.release || "—";
                    $("._code").textContent = d.codename || d.codepage || "—";
                    $("._kernel").textContent = d.kernel || "—";
                    $("._arch").textContent = d.arch || "—";
                    $("._msg").textContent = "";
                } catch (e) {
                    if (alive) $("._msg").textContent = "error";
                } finally { busy = false; }
            };
            tick();
            const iv = setInterval(tick, 60000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
