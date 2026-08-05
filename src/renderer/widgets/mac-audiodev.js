"use strict";
window.I18N.register({
    en: { "widget.mac_audiodev": "Audio Devices", "cat.system": "System" },
    ru: { "widget.mac_audiodev": "Аудио устройства", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.mac_audiodev = {
    id: "mac_audiodev",
    title: "widget.mac_audiodev",
    category: "system",
    description: "Output/input device & volume (osascript)",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div class="metric-row"><span class="k">🔊 OUTPUT VOL</span><span class="v"><b id="_aud_vol">…</b></span></div>
              <div class="bar"><i id="_aud_bar" style="width:0%"></i></div>
              <div class="metric-row" style="margin-top:6px"><span class="k">MUTED</span><span class="v" id="_aud_mute">—</span></div>
              <div class="metric-row"><span class="k">INPUT VOL</span><span class="v" id="_aud_inp">—</span></div>
              <div id="_aud_msg" style="color:var(--text-dim);font-size:11px;margin-top:4px"></div>
              <div style="display:flex;gap:8px;align-items:center;margin-top:auto">
                <button id="_aud_go" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 12px;cursor:pointer;font-size:11px">Refresh</button>
                <button id="_aud_mtog" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 12px;cursor:pointer;font-size:11px">Toggle mute</button>
                <span id="_aud_meta" style="color:var(--text-dim);font-size:11px;margin-left:auto"></span>
              </div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, isMac = null;

        const OSA = 'set ov to output volume of (get volume settings)\nset iv to input volume of (get volume settings)\nset mu to output muted of (get volume settings)\nreturn (ov as string) & "|" & (iv as string) & "|" & (mu as string)';

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            $("#_aud_meta").textContent = "…";
            try {
                if (isMac === null) isMac = (await window.dyo.appInfo()).platform === "darwin";
                if (!isMac) {
                    $("#_aud_vol").textContent = "n/a";
                    $("#_aud_msg").innerHTML = `<span style="color:var(--text-dim)">Audio widget is macOS-only.</span>`;
                    $("#_aud_meta").textContent = "";
                    return;
                }
                const r = await window.dyo.exec("osascript", ["-e", OSA], { timeout: 6000 });
                if (!alive) return;
                if (!r || r.code !== 0 || !r.stdout.trim()) {
                    $("#_aud_msg").innerHTML = `<span style="color:var(--danger)">${esc((r && r.stderr && r.stderr.trim().split("\n")[0]) || "osascript unavailable")}</span>`;
                    $("#_aud_meta").textContent = "";
                    return;
                }
                const p = r.stdout.trim().split("|");
                const ov = parseInt(p[0], 10);
                const iv = parseInt(p[1], 10);
                const mu = /true|missing/i.test(p[2]) ? /true/i.test(p[2]) : (p[2] || "").trim();
                $("#_aud_vol").textContent = isNaN(ov) ? "—" : ov + "%";
                $("#_aud_bar").style.width = (isNaN(ov) ? 0 : ov) + "%";
                $("#_aud_mute").textContent = (typeof mu === "boolean") ? (mu ? "yes" : "no") : String(mu);
                $("#_aud_inp").textContent = isNaN(iv) ? "—" : iv + "%";
                $("#_aud_msg").textContent = "";
                $("#_aud_meta").textContent = new Date().toLocaleTimeString(window.I18N.locale());
            } catch (e) {
                if (alive) { $("#_aud_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`; $("#_aud_meta").textContent = ""; }
            } finally { busy = false; }
        };
        $("#_aud_go").onclick = tick;
        $("#_aud_mtog").onclick = async () => {
            if (isMac === false) return;
            await window.dyo.exec("osascript", ["-e", "set volume output muted (not (output muted of (get volume settings)))"], { timeout: 6000 }).catch(() => {});
            setTimeout(tick, 400);
        };
        tick();
        const iv = setInterval(tick, 5000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
