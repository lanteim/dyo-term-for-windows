"use strict";
window.I18N.register({
    en: { "widget.mac_batteryhealth": "Battery Health", "cat.system": "System" },
    ru: { "widget.mac_batteryhealth": "Здоровье батареи", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.mac_batteryhealth = {
    id: "mac_batteryhealth",
    title: "widget.mac_batteryhealth",
    category: "system",
    description: "Battery cycles, condition & max capacity",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div class="metric-row"><span class="k">🔋 CONDITION</span><span class="v"><b id="_bh_cond">…</b></span></div>
              <div class="metric-row"><span class="k">CYCLE COUNT</span><span class="v" id="_bh_cycles">—</span></div>
              <div class="metric-row"><span class="k">MAX CAPACITY</span><span class="v" id="_bh_maxcap">—</span></div>
              <div class="bar"><i id="_bh_bar" style="width:0%"></i></div>
              <div class="metric-row" style="margin-top:6px"><span class="k">CHARGE NOW</span><span class="v" id="_bh_now">—</span></div>
              <div id="_bh_msg" style="color:var(--text-dim);font-size:11px;margin-top:2px"></div>
              <div style="display:flex;gap:8px;align-items:center;margin-top:auto">
                <button id="_bh_go" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 12px;cursor:pointer;font-size:11px">Refresh</button>
                <span id="_bh_meta" style="color:var(--text-dim);font-size:11px;margin-left:auto"></span>
              </div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, isMac = null;

        const grab = (txt, re) => { const m = txt.match(re); return m ? m[1].trim() : null; };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            $("#_bh_meta").textContent = "…";
            try {
                if (isMac === null) isMac = (await window.dyo.appInfo()).platform === "darwin";
                if (!isMac) {
                    $("#_bh_cond").textContent = "n/a";
                    $("#_bh_msg").innerHTML = `<span style="color:var(--text-dim)">Battery health reads via macOS system_profiler.</span>`;
                    $("#_bh_meta").textContent = "";
                    return;
                }
                const r = await window.dyo.exec("system_profiler", ["SPPowerDataType"], { timeout: 12000 });
                if (!alive) return;
                if (!r || r.code !== 0 || !r.stdout) {
                    $("#_bh_msg").innerHTML = `<span style="color:var(--danger)">${esc((r && r.stderr && r.stderr.trim().split("\n")[0]) || "no power data (desktop Mac?)")}</span>`;
                    $("#_bh_meta").textContent = "";
                    return;
                }
                const txt = r.stdout;
                const cond = grab(txt, /Condition:\s*(.+)/);
                const cycles = grab(txt, /Cycle Count:\s*(\d+)/);
                const maxcap = grab(txt, /Maximum Capacity:\s*([^\n]+)/);
                const full = grab(txt, /Full Charge Capacity \(mAh\):\s*(\d+)/);
                const design = grab(txt, /Design Capacity(?:\s*\(mAh\))?:\s*(\d+)/i);
                const chargeNow = grab(txt, /State of Charge \(%\):\s*(\d+)/) || grab(txt, /Charge Remaining \(mAh\):\s*(\d+)/);
                const charging = /Charging:\s*Yes/i.test(txt);

                if (!cond && !cycles && !maxcap && !full) {
                    $("#_bh_msg").innerHTML = `<span style="color:var(--text-dim)">No battery detected on this Mac.</span>`;
                }
                $("#_bh_cond").textContent = cond || "—";
                if (cond) $("#_bh_cond").style.color = /normal|good/i.test(cond) ? "var(--accent2)" : "var(--danger)";
                $("#_bh_cycles").textContent = cycles || "—";

                // Prefer reported Maximum Capacity %, else compute from full/design mAh.
                let pct = null;
                if (maxcap && /%/.test(maxcap)) pct = parseInt(maxcap, 10);
                else if (full && design) pct = Math.round(parseInt(full, 10) / parseInt(design, 10) * 100);
                $("#_bh_maxcap").textContent = maxcap ? maxcap : (pct != null ? pct + "%" : (full ? full + " mAh" : "—"));
                $("#_bh_bar").style.width = (pct != null ? Math.min(100, pct) : 0) + "%";

                $("#_bh_now").textContent = chargeNow ? (/%/.test(String(chargeNow)) || parseInt(chargeNow, 10) <= 100 && !full ? chargeNow + (/%/.test(String(chargeNow)) ? "" : "%") : chargeNow + " mAh") + (charging ? " · charging" : "") : (charging ? "charging" : "—");
                if (cond || cycles) $("#_bh_msg").textContent = "";
                $("#_bh_meta").textContent = new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) { $("#_bh_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`; $("#_bh_meta").textContent = ""; }
            } finally { busy = false; }
        };
        $("#_bh_go").onclick = tick;
        tick();
        const iv = setInterval(tick, 30000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
