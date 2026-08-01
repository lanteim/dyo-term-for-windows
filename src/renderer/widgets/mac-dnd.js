"use strict";
window.I18N.register({
    en: { "widget.mac_dnd": "Focus / DND", "cat.system": "System" },
    ru: { "widget.mac_dnd": "Фокус / Не беспокоить", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.mac_dnd = {
    id: "mac_dnd",
    title: "widget.mac_dnd",
    category: "system",
    description: "macOS Focus / Do Not Disturb status",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
              <div class="metric-row"><span class="k">🌙 FOCUS / DND</span><span class="v"><b id="_dnd_state">…</b></span></div>
              <div id="_dnd_detail" style="color:var(--text-dim);font-size:11px;min-height:14px"></div>
              <div id="_dnd_msg" style="color:var(--text-dim);font-size:11px"></div>
              <div style="display:flex;gap:8px;align-items:center;margin-top:auto">
                <button id="_dnd_go" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 12px;cursor:pointer;font-size:11px">Refresh</button>
                <button id="_dnd_open" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 12px;cursor:pointer;font-size:11px">Open Settings</button>
                <span id="_dnd_meta" style="color:var(--text-dim);font-size:11px;margin-left:auto"></span>
              </div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, isMac = null;

        const setState = (txt, color) => { $("#_dnd_state").textContent = txt; $("#_dnd_state").style.color = color || "var(--text)"; };

        const readFocus = async () => {
            // Try modern Focus DB (Monterey+): assertions.json holds active focus modes.
            const home = (await window.dyo.appInfo()).home;
            const path = home + "/Library/DoNotDisturb/DB/Assertions.json";
            const r = await window.dyo.fs.read(path).catch(() => null);
            if (r && typeof r === "string" && r.trim()) {
                try {
                    const j = JSON.parse(r);
                    const recs = (j && j.data && j.data[0] && j.data[0].storeAssertionRecords) || [];
                    if (recs.length) {
                        const mode = recs[0].assertionDetails && recs[0].assertionDetails.assertionDetailsModeIdentifier;
                        return { on: true, detail: mode ? String(mode).split(".").pop() : "" };
                    }
                    return { on: false, detail: "" };
                } catch (e) { /* fall through */ }
            }
            return null;
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            $("#_dnd_meta").textContent = "checking…";
            try {
                if (isMac === null) isMac = (await window.dyo.appInfo()).platform === "darwin";
                if (!isMac) {
                    setState("n/a", "var(--text-dim)");
                    $("#_dnd_msg").innerHTML = `<span style="color:var(--text-dim)">Focus / DND is macOS-only.</span>`;
                    $("#_dnd_meta").textContent = "";
                    return;
                }
                const f = await readFocus();
                if (!alive) return;
                if (f) {
                    setState(f.on ? "ON" : "OFF", f.on ? "var(--accent2)" : "var(--text-dim)");
                    $("#_dnd_detail").textContent = f.on && f.detail ? "Mode: " + f.detail : "";
                    $("#_dnd_msg").textContent = "";
                } else {
                    setState("status only", "var(--text-dim)");
                    $("#_dnd_detail").textContent = "";
                    $("#_dnd_msg").innerHTML = `<span style="color:var(--text-dim)">Focus state not readable on this macOS build. Toggle via Control Center.</span>`;
                }
                $("#_dnd_meta").textContent = new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) { $("#_dnd_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`; $("#_dnd_meta").textContent = ""; }
            } finally { busy = false; }
        };
        $("#_dnd_go").onclick = tick;
        $("#_dnd_open").onclick = () => { window.dyo.exec("open", ["x-apple.systempreferences:com.apple.Focus-Settings.extension"], { timeout: 5000 }).catch(() => {}); };
        tick();
        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
