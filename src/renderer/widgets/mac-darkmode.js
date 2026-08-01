"use strict";
window.I18N.register({
    en: { "widget.mac_darkmode": "Dark Mode", "cat.system": "System" },
    ru: { "widget.mac_darkmode": "Тёмная тема", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.mac_darkmode = {
    id: "mac_darkmode",
    title: "widget.mac_darkmode",
    category: "system",
    description: "Read & toggle macOS appearance",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
              <div class="metric-row"><span class="k">🌗 APPEARANCE</span><span class="v"><b id="_dm_state">…</b></span></div>
              <div id="_dm_msg" style="color:var(--text-dim);font-size:11px;min-height:14px"></div>
              <div style="display:flex;gap:8px;align-items:center;margin-top:auto">
                <button id="_dm_toggle" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 12px;cursor:pointer;font-size:11px">Toggle Dark/Light</button>
                <button id="_dm_go" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 12px;cursor:pointer;font-size:11px">Refresh</button>
                <span id="_dm_meta" style="color:var(--text-dim);font-size:11px;margin-left:auto"></span>
              </div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, isMac = null;

        const readState = async () => {
            // Returns "Dark" when dark mode on; errors (code!=0) when light (key absent).
            const r = await window.dyo.exec("defaults", ["read", "-g", "AppleInterfaceStyle"], { timeout: 5000 }).catch(() => null);
            if (!r) return null;
            if (r.code === 0 && /dark/i.test(r.stdout)) return "Dark";
            // non-zero or empty => Light (key not set)
            return "Light";
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            $("#_dm_meta").textContent = "…";
            try {
                if (isMac === null) isMac = (await window.dyo.appInfo()).platform === "darwin";
                if (!isMac) {
                    $("#_dm_state").textContent = "n/a";
                    $("#_dm_msg").innerHTML = `<span style="color:var(--text-dim)">Dark Mode toggle is macOS-only.</span>`;
                    $("#_dm_meta").textContent = "";
                    return;
                }
                const s = await readState();
                if (!alive) return;
                if (s === null) {
                    $("#_dm_state").textContent = "?";
                    $("#_dm_msg").innerHTML = `<span style="color:var(--text-dim)">Could not read appearance.</span>`;
                } else {
                    $("#_dm_state").textContent = s;
                    $("#_dm_state").style.color = s === "Dark" ? "var(--accent2)" : "var(--accent)";
                    $("#_dm_msg").textContent = "";
                }
                $("#_dm_meta").textContent = new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) { $("#_dm_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`; $("#_dm_meta").textContent = ""; }
            } finally { busy = false; }
        };

        $("#_dm_toggle").onclick = async () => {
            if (isMac === false) return;
            $("#_dm_msg").textContent = "toggling…";
            const r = await window.dyo.exec("osascript", ["-e", 'tell application "System Events" to tell appearance preferences to set dark mode to not dark mode'], { timeout: 8000 }).catch(() => null);
            if (r && r.code !== 0 && r.stderr) {
                $("#_dm_msg").innerHTML = `<span style="color:var(--danger)">${esc(r.stderr.trim().split("\n")[0])} (grant Automation → System Events)</span>`;
            }
            setTimeout(tick, 600);
        };
        $("#_dm_go").onclick = tick;
        tick();
        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
