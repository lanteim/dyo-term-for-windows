"use strict";
window.I18N.register({
    en: { "widget.mac_caffeinate": "Caffeinate", "cat.system": "System" },
    ru: { "widget.mac_caffeinate": "Не спать", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.mac_caffeinate = {
    id: "mac_caffeinate",
    title: "widget.mac_caffeinate",
    category: "system",
    description: "Keep macOS awake (caffeinate)",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
              <div class="metric-row"><span class="k">☕ CAFFEINATE</span><span class="v"><b id="_caf_state">…</b></span></div>
              <div id="_caf_detail" style="color:var(--text-dim);font-size:11px;min-height:14px"></div>
              <div id="_caf_msg" style="color:var(--text-dim);font-size:11px"></div>
              <div style="display:flex;gap:8px;align-items:center;margin-top:auto;flex-wrap:wrap">
                <button id="_caf_on" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 12px;cursor:pointer;font-size:11px">Prevent sleep</button>
                <button id="_caf_off" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 12px;cursor:pointer;font-size:11px">Stop</button>
                <button id="_caf_go" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 12px;cursor:pointer;font-size:11px">Refresh</button>
                <span id="_caf_meta" style="color:var(--text-dim);font-size:11px;margin-left:auto"></span>
              </div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, isMac = null;

        const setState = (txt, color) => { $("#_caf_state").textContent = txt; $("#_caf_state").style.color = color || "var(--text)"; };

        const running = async () => {
            const r = await window.dyo.exec("pgrep", ["-x", "caffeinate"], { timeout: 5000 }).catch(() => null);
            if (!r) return null;
            // pgrep exits 0 with pids, 1 if none.
            if (r.code === 0 && r.stdout.trim()) return r.stdout.trim().split("\n").filter(Boolean);
            if (r.code === 1) return [];
            return null;
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            $("#_caf_meta").textContent = "checking…";
            try {
                if (isMac === null) isMac = (await window.dyo.appInfo()).platform === "darwin";
                if (!isMac) {
                    setState("n/a", "var(--text-dim)");
                    $("#_caf_msg").innerHTML = `<span style="color:var(--text-dim)">caffeinate is macOS-only.</span>`;
                    $("#_caf_meta").textContent = "";
                    return;
                }
                const pids = await running();
                if (!alive) return;
                if (pids === null) {
                    setState("?", "var(--text-dim)");
                    $("#_caf_detail").textContent = "";
                    $("#_caf_msg").innerHTML = `<span style="color:var(--text-dim)">Could not query process list.</span>`;
                } else if (pids.length) {
                    setState("AWAKE (active)", "var(--accent2)");
                    $("#_caf_detail").textContent = pids.length + " caffeinate process" + (pids.length > 1 ? "es" : "") + " · pid " + pids.join(", ");
                    $("#_caf_msg").textContent = "";
                } else {
                    setState("normal (may sleep)", "var(--text-dim)");
                    $("#_caf_detail").textContent = "";
                    $("#_caf_msg").textContent = "";
                }
                $("#_caf_meta").textContent = new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) { $("#_caf_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`; $("#_caf_meta").textContent = ""; }
            } finally { busy = false; }
        };

        $("#_caf_on").onclick = () => {
            if (window.term && window.term.runInFocused) {
                window.term.runInFocused("caffeinate -d\n");
                $("#_caf_msg").innerHTML = `<span style="color:var(--text-dim)">Started in focused terminal. Ctrl-C there (or Stop) to release.</span>`;
                setTimeout(tick, 900);
            } else {
                $("#_caf_msg").innerHTML = `<span style="color:var(--text-dim)">Run <code>caffeinate -d</code> in a terminal to keep the Mac awake.</span>`;
            }
        };
        $("#_caf_off").onclick = async () => {
            const r = await window.dyo.exec("pkill", ["-x", "caffeinate"], { timeout: 5000 }).catch(() => null);
            if (r && (r.code === 0 || r.code === 1)) $("#_caf_msg").innerHTML = `<span style="color:var(--text-dim)">Stopped caffeinate processes.</span>`;
            else $("#_caf_msg").innerHTML = `<span style="color:var(--text-dim)">If started in a terminal, press Ctrl-C there.</span>`;
            setTimeout(tick, 700);
        };
        $("#_caf_go").onclick = tick;
        tick();
        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
