"use strict";
window.I18N.register({
    en: { "widget.ci_buildstatus": "Build Status Badge", "cat.cicd": "CI/CD" },
    ru: { "widget.ci_buildstatus": "Статус сборки", "cat.cicd": "CI/CD" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.ci_buildstatus = {
    id: "ci_buildstatus",
    title: "widget.ci_buildstatus",
    category: "cicd",
    description: "Generic build status from a shields.io-style JSON badge endpoint",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div id="_bs_cfg" style="display:none;flex-direction:column;gap:6px">
              <input id="_bs_url" placeholder="Badge JSON URL (e.g. https://img.shields.io/.../badge.json)" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11px"/>
              <div style="color:var(--text-dim);font-size:10px">Expects JSON with fields like {"label","message"} (shields endpoint) or {"status"/"state","color"}.</div>
              <button id="_bs_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px">Save</button>
            </div>
            <div id="_bs_main" style="display:none;flex-direction:column;gap:8px;height:100%">
              <div id="_bs_badge" style="display:flex;align-items:center;gap:0;border-radius:6px;overflow:hidden;font-family:var(--font-mono);font-size:14px;align-self:flex-start;max-width:100%">
                <span id="_bs_label" style="background:#555;color:#fff;padding:6px 10px;white-space:nowrap">status</span>
                <span id="_bs_msg" style="background:#9f9f9f;color:#fff;padding:6px 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">…</span>
              </div>
              <div id="_bs_err" style="color:var(--danger);font-size:11px"></div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto">
                <span id="_bs_meta" style="color:var(--text-dim);font-size:11px"></span>
                <button id="_bs_edit" title="Settings" aria-label="Settings" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">⚙</button>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, url = "";
        const showCfg = show => { $("#_bs_cfg").style.display = show ? "flex" : "none"; $("#_bs_main").style.display = show ? "none" : "flex"; };

        // Map textual/shields color names to concrete hex, else pass through.
        const colorHex = c => {
            const map = { brightgreen: "#4c1", green: "#97ca00", yellowgreen: "#a4a61d", yellow: "#dfb317", orange: "#fe7d37", red: "#e05d44", blue: "#007ec6", lightgrey: "#9f9f9f", grey: "#9f9f9f", gray: "#9f9f9f", success: "#4c1", passing: "#4c1", failing: "#e05d44", failure: "#e05d44", error: "#e05d44", critical: "#e05d44", important: "#fe7d37", inactive: "#9f9f9f" };
            if (!c) return "";
            const key = String(c).toLowerCase();
            if (map[key]) return map[key];
            if (/^#?[0-9a-f]{3,8}$/i.test(String(c))) return String(c)[0] === "#" ? String(c) : "#" + c;
            return "";
        };
        const guessColor = msg => {
            const m = String(msg || "").toLowerCase();
            if (/pass|success|ok|healthy|up|green|stable/.test(m)) return "#4c1";
            if (/fail|error|down|broken|red|critical/.test(m)) return "#e05d44";
            if (/pend|running|build|progress|queue/.test(m)) return "#dfb317";
            return "#9f9f9f";
        };

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            url = (s && s["ci.buildstatus.url"]) || "";
            $("#_bs_url").value = url;
            if (!url) showCfg(true); else { showCfg(false); tick(); }
        });

        $("#_bs_save").onclick = async () => {
            url = $("#_bs_url").value.trim();
            await window.dyo.settings.set({ "ci.buildstatus.url": url });
            if (url) { showCfg(false); tick(); }
        };
        $("#_bs_edit").onclick = () => showCfg(true);

        const tick = async () => {
            if (!alive || busy || !url) return;
            busy = true;
            $("#_bs_meta").textContent = "polling…";
            try {
                const r = await window.dyo.http(url, { timeout: 9000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_bs_err").textContent = (r && r.error) || ("HTTP " + (r && r.status));
                    $("#_bs_meta").textContent = "unavailable";
                    return;
                }
                let j; try { j = JSON.parse(r.text); } catch (e) { j = null; }
                if (!j || typeof j !== "object") {
                    // Not JSON — show raw trimmed text as message
                    $("#_bs_err").textContent = "";
                    $("#_bs_label").textContent = "status";
                    const raw = String(r.text || "").trim().slice(0, 40);
                    $("#_bs_msg").textContent = raw || "—";
                    $("#_bs_msg").style.background = guessColor(raw);
                    $("#_bs_meta").textContent = "updated " + new Date().toLocaleTimeString();
                    return;
                }
                const label = j.label || j.name || "status";
                const message = j.message != null ? j.message : (j.status != null ? j.status : (j.state != null ? j.state : "—"));
                const color = colorHex(j.color) || colorHex(message) || guessColor(message);
                $("#_bs_err").textContent = "";
                $("#_bs_label").textContent = String(label);
                $("#_bs_msg").textContent = String(message);
                $("#_bs_msg").style.background = color;
                $("#_bs_meta").textContent = "updated " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) $("#_bs_err").textContent = esc(e && e.message);
            } finally { busy = false; }
        };

        const iv = setInterval(tick, 20000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
