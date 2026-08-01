"use strict";
window.I18N.register({
    en: { "widget.dkx_registry": "Docker Registry", "cat.docker": "Docker" },
    ru: { "widget.dkx_registry": "Docker реестр", "cat.docker": "Docker" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
    const SKEY = "dkx_registry.url";

    window.WIDGETS.dkx_registry = {
        id: "dkx_registry",
        title: "widget.dkx_registry",
        category: "docker",
        description: "Configured registry or docker info registries",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:6px">
                    <span style="color:var(--text-dim)">🐳 REGISTRY</span>
                    <input id="_dkr_url" placeholder="registry url (optional)"
                      style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);flex:1;min-width:60px">
                    <button id="_dkr_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:5px 10px;cursor:pointer">Save</button>
                  </div>
                  <div id="_dkr_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:8px"></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const saved = ((window.dyo.settings.get() || {})[SKEY]) || "";
            $("#_dkr_url").value = saved;

            const rowHtml = (k, v) => `<div style="display:flex;gap:8px;padding:3px 0"><span style="color:var(--text-dim);min-width:110px">${esc(k)}</span><span style="color:var(--text);font-family:var(--font-mono);word-break:break-all">${esc(v)}</span></div>`;

            const showConfigured = (url) => {
                $("#_dkr_body").innerHTML =
                    `<div style="color:var(--accent);font-weight:600;margin-bottom:4px">Configured registry</div>` +
                    rowHtml("url", url) +
                    `<div style="margin-top:8px"><button id="_dkr_open" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 10px;cursor:pointer">Open</button></div>`;
                const ob = $("#_dkr_open");
                if (ob) ob.addEventListener("click", () => {
                    let u = url; if (!/^https?:\/\//i.test(u)) u = "https://" + u;
                    window.dyo.openExternal(u);
                });
            };

            const showInfo = async () => {
                busy = true;
                try {
                    const res = await window.dyo.exec("docker", ["info", "--format", "{{json .RegistryConfig}}"], { timeout: 8000 });
                    if (!res || res.code !== 0) {
                        const err = (res && (res.stderr || "")).toLowerCase();
                        let msg = "docker not available";
                        if (err.includes("cannot connect") || err.includes("daemon")) msg = "daemon not running";
                        else if (err.includes("not found") || (res && res.code === 127)) msg = "docker not found";
                        $("#_dkr_body").innerHTML = `<div style="color:var(--text-dim)">${esc(msg)}<br>Set a registry url above to configure one.</div>`;
                        return;
                    }
                    let cfg = null;
                    try { cfg = JSON.parse((res.stdout || "").trim()); } catch (e) { cfg = null; }
                    let html = `<div style="color:var(--accent);font-weight:600;margin-bottom:4px">docker info registries</div>`;
                    if (cfg && cfg.IndexConfigs) {
                        const names = Object.keys(cfg.IndexConfigs);
                        if (names.length) names.forEach(n => {
                            const ic = cfg.IndexConfigs[n];
                            html += rowHtml(n, (ic.Secure ? "secure" : "insecure") + (ic.Official ? ", official" : ""));
                        });
                        else html += `<div style="color:var(--text-dim)">no index configs</div>`;
                    } else {
                        html += `<div style="color:var(--text-dim)">${esc((res.stdout || "").trim() || "no registry config")}</div>`;
                    }
                    if (cfg && Array.isArray(cfg.Mirrors) && cfg.Mirrors.length) {
                        html += `<div style="color:var(--text-dim);margin-top:6px">mirrors: ${esc(cfg.Mirrors.join(", "))}</div>`;
                    }
                    html += `<div style="color:var(--text-dim);margin-top:8px;font-size:11px">Tip: set a registry url above to pin one.</div>`;
                    $("#_dkr_body").innerHTML = html;
                } catch (e) { $("#_dkr_body").innerHTML = `<div style="color:var(--text-dim)">error</div>`; } finally { busy = false; }
            };

            const refresh = () => {
                const url = ((window.dyo.settings.get() || {})[SKEY]) || "";
                if (url) showConfigured(url); else showInfo();
            };

            $("#_dkr_save").addEventListener("click", () => {
                const url = $("#_dkr_url").value.trim();
                window.dyo.settings.set({ [SKEY]: url });
                refresh();
            });
            $("#_dkr_url").addEventListener("keydown", e => { if (e.key === "Enter") $("#_dkr_save").click(); });

            refresh();
            return { destroy: () => { alive = false; } };
        }
    };
})();
