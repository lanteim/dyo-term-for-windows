"use strict";
window.I18N.register({
    en: { "widget.mac_bluetooth": "Bluetooth", "cat.system": "System" },
    ru: { "widget.mac_bluetooth": "Bluetooth", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.mac_bluetooth = {
    id: "mac_bluetooth",
    title: "widget.mac_bluetooth",
    category: "system",
    description: "Bluetooth power & connected devices",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div class="metric-row"><span class="k">📶 BLUETOOTH</span><span class="v"><b id="_bt_pwr">…</b></span></div>
              <div id="_bt_list" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:4px"></div>
              <div id="_bt_msg" style="color:var(--text-dim);font-size:11px"></div>
              <div style="display:flex;gap:8px;align-items:center">
                <button id="_bt_go" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 12px;cursor:pointer;font-size:11px">Refresh</button>
                <span id="_bt_meta" style="color:var(--text-dim);font-size:11px;margin-left:auto"></span>
              </div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, isMac = null;

        const renderDevices = (devs, connectedOnly) => {
            if (!devs.length) {
                $("#_bt_list").innerHTML = `<div style="color:var(--text-dim);padding:6px">No ${connectedOnly ? "connected " : ""}devices.</div>`;
                return;
            }
            $("#_bt_list").innerHTML = devs.slice(0, 200).map(d => `
                <div class="metric-row" style="align-items:center">
                  <span class="k" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%">${d.connected ? "🟢" : "⚪"} ${esc(d.name)}</span>
                  <span class="v" style="color:var(--text-dim)">${esc([d.type, d.battery != null ? d.battery + "%" : ""].filter(Boolean).join(" · "))}</span>
                </div>`).join("");
        };

        // Parse `blueutil --paired`/`--connected` style or system_profiler text.
        const viaBlueutil = async () => {
            const [conn, paired] = await Promise.all([
                window.dyo.exec("blueutil", ["--connected"], { timeout: 6000 }).catch(() => null),
                window.dyo.exec("blueutil", ["--paired"], { timeout: 6000 }).catch(() => null)
            ]);
            const pwr = await window.dyo.exec("blueutil", ["--power"], { timeout: 5000 }).catch(() => null);
            if (!paired && !conn) return null;
            if (paired && paired.code !== 0 && conn && conn.code !== 0) return null;
            const connSet = new Set();
            const parse = txt => (txt || "").split("\n").map(l => l.trim()).filter(Boolean).map(l => {
                const nm = (l.match(/name:\s*"([^"]*)"/) || [])[1] || "device";
                const addr = (l.match(/address:\s*([0-9a-fA-F:-]+)/) || [])[1] || "";
                return { addr, name: nm };
            });
            parse(conn && conn.stdout).forEach(d => connSet.add(d.addr));
            const devs = parse(paired && paired.stdout).map(d => ({ name: d.name, connected: connSet.has(d.addr), type: "", battery: null }));
            const power = pwr && pwr.stdout ? (pwr.stdout.trim() === "1" ? "ON" : "OFF") : "ON";
            return { power, devices: devs };
        };

        const viaProfiler = async () => {
            const r = await window.dyo.exec("system_profiler", ["SPBluetoothDataType", "-detailLevel", "basic"], { timeout: 12000 }).catch(() => null);
            if (!r || r.code !== 0 || !r.stdout) return null;
            const lines = r.stdout.split("\n");
            let power = "ON";
            const devices = [];
            let inConnected = false, inNotConnected = false;
            let cur = null;
            const flush = () => { if (cur) { devices.push(cur); cur = null; } };
            for (let raw of lines) {
                const line = raw.replace(/\s+$/, "");
                const indent = line.length - line.replace(/^\s+/, "").length;
                const t = line.trim();
                if (/^State:/.test(t) && indent <= 8) power = /On/i.test(t) ? "ON" : "OFF";
                if (/^Connected:/.test(t)) { flush(); inConnected = true; inNotConnected = false; continue; }
                if (/^Not Connected:/.test(t)) { flush(); inConnected = false; inNotConnected = true; continue; }
                if ((inConnected || inNotConnected) && /:\s*$/.test(t) && indent >= 10 && indent <= 14) {
                    flush();
                    cur = { name: t.replace(/:\s*$/, ""), connected: inConnected, type: "", battery: null };
                    continue;
                }
                if (cur) {
                    const bm = t.match(/Battery Level:\s*(\d+)%/);
                    if (bm) cur.battery = parseInt(bm[1], 10);
                    const tm = t.match(/Minor Type:\s*(.+)/);
                    if (tm) cur.type = tm[1].trim();
                }
            }
            flush();
            return { power, devices };
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            $("#_bt_meta").textContent = "checking…";
            try {
                if (isMac === null) isMac = (await window.dyo.appInfo()).platform === "darwin";
                if (!isMac) {
                    $("#_bt_pwr").textContent = "n/a";
                    $("#_bt_list").innerHTML = "";
                    $("#_bt_msg").innerHTML = `<span style="color:var(--text-dim)">Bluetooth widget is macOS-only.</span>`;
                    $("#_bt_meta").textContent = "";
                    return;
                }
                let res = await viaBlueutil();
                let src = "blueutil";
                if (!res) { res = await viaProfiler(); src = "system_profiler"; }
                if (!alive) return;
                if (!res) {
                    $("#_bt_pwr").textContent = "?";
                    $("#_bt_list").innerHTML = "";
                    $("#_bt_msg").innerHTML = `<span style="color:var(--text-dim)">Bluetooth info unavailable (install <code>blueutil</code> for details).</span>`;
                } else {
                    $("#_bt_pwr").textContent = res.power;
                    $("#_bt_pwr").style.color = res.power === "ON" ? "var(--accent2)" : "var(--text-dim)";
                    // connected first
                    res.devices.sort((a, b) => (b.connected ? 1 : 0) - (a.connected ? 1 : 0));
                    renderDevices(res.devices, false);
                    $("#_bt_msg").innerHTML = `<span style="color:var(--text-dim)">via ${src}</span>`;
                }
                $("#_bt_meta").textContent = new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) { $("#_bt_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`; $("#_bt_meta").textContent = ""; }
            } finally { busy = false; }
        };
        $("#_bt_go").onclick = tick;
        tick();
        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
