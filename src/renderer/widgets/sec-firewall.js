"use strict";
window.I18N.register({
    en: { "widget.sec_firewall": "Firewall", "cat.security": "Security" },
    ru: { "widget.sec_firewall": "Брандмауэр", "cat.security": "Безопасность" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.sec_firewall = {
    id: "sec_firewall",
    title: "widget.sec_firewall",
    category: "security",
    description: "macOS Application Firewall global state and options",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="color:var(--text-dim)">Application Firewall</span>
                <button class="_fw_go" title="Refresh" aria-label="Refresh" style="margin-left:auto;background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:3px 9px;cursor:pointer;font-size:11px">↻</button>
              </div>
              <div class="_fw_body" style="flex:1;overflow:auto"><div style="color:var(--text-dim)">Loading…</div></div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const FW = "/usr/libexec/ApplicationFirewall/socketfilterfw";

        const stateOf = (txt) => {
            const t = (txt || "").toLowerCase();
            if (/enabled|on|allow all/.test(t) && !/disabled|off/.test(t)) return true;
            if (/disabled|off/.test(t)) return false;
            return null;
        };
        const row = (k, txt, good) => {
            const on = stateOf(txt);
            let col = "var(--text-dim)", label = txt || "unknown";
            if (on !== null) {
                const desirable = (good === "on") ? on : (good === "off") ? !on : on;
                col = desirable ? "var(--accent)" : "var(--accent2)";
            }
            return `<div class="metric-row"><span class="k">${esc(k)}</span><span class="v"><b style="color:${col}">${esc(label)}</b></span></div>`;
        };

        const load = async () => {
            if (!alive || busy) return;
            busy = true;
            $("._fw_go").disabled = true;
            try {
                const [g, s, b] = await Promise.all([
                    window.dyo.exec(FW, ["--getglobalstate"], { timeout: 6000 }),
                    window.dyo.exec(FW, ["--getstealthmode"], { timeout: 6000 }),
                    window.dyo.exec(FW, ["--getblockall"], { timeout: 6000 })
                ]);
                if (!alive) return;
                const clean = r => (r && r.stdout || "").trim().replace(/\s+/g, " ");
                const gs = clean(g);
                if (!gs && !(g && g.code === 0)) {
                    const err = (g && g.stderr && g.stderr.trim().split("\n")[0]) || "socketfilterfw not available";
                    $("._fw_body").innerHTML = `<div style="color:var(--danger)">Could not read firewall state.</div><div style="color:var(--text-dim);font-size:11px;margin-top:4px">${esc(err)}</div><div style="color:var(--text-dim);font-size:11px;margin-top:2px">Some queries may require admin rights.</div>`;
                    return;
                }
                const nice = (raw) => raw.replace(/^Firewall is\s*/i, "").replace(/^Stealth mode\s*/i, "").replace(/^Block all\s*(DNS\s*)?/i, "");
                let html = "";
                html += row("GLOBAL STATE", nice(gs) || "unknown", "on");
                if (clean(s)) html += row("STEALTH MODE", nice(clean(s)) || "unknown", "on");
                if (clean(b)) html += row("BLOCK ALL", nice(clean(b)) || "unknown", null);
                const enabled = stateOf(gs);
                if (enabled === false) html += `<div style="color:var(--accent2);font-size:11px;margin-top:6px">⚠ Firewall is off. Enable it in System Settings → Network → Firewall.</div>`;
                $("._fw_body").innerHTML = html;
            } catch (e) {
                if (alive) $("._fw_body").innerHTML = `<div style="color:var(--danger)">Error: ${esc(e && e.message)}</div>`;
            } finally {
                if (alive) $("._fw_go").disabled = false;
                busy = false;
            }
        };
        $("._fw_go").onclick = load;
        load();
        const iv = setInterval(load, 15000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
