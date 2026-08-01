"use strict";
window.I18N.register({
    en: { "widget.dkx_inspect": "Docker Inspect", "cat.docker": "Docker" },
    ru: { "widget.dkx_inspect": "Docker Inspect", "cat.docker": "Docker" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
    const SKEY = "dkx_inspect.container";

    window.WIDGETS.dkx_inspect = {
        id: "dkx_inspect",
        title: "widget.dkx_inspect",
        category: "docker",
        description: "Inspect key fields of a container",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:6px">
                    <span style="color:var(--text-dim)">🐳 INSPECT</span>
                    <input id="_dki_name" placeholder="container name or id"
                      style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);flex:1;min-width:60px">
                    <button id="_dki_go" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:5px 10px;cursor:pointer">Go</button>
                  </div>
                  <div id="_dki_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:8px"><div style="color:var(--text-dim)">…</div></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const saved = ((window.dyo.settings.get() || {})[SKEY]) || "";
            $("#_dki_name").value = saved;

            const FMT = "{{.Config.Image}}\t{{range $k,$v := .NetworkSettings.Networks}}{{$v.IPAddress}} {{end}}\t{{range $p,$c := .NetworkSettings.Ports}}{{$p}} {{end}}\t{{.State.Status}}";

            const rowHtml = (k, v) => `<div class="metric-row" style="display:flex;gap:8px;padding:3px 0"><span class="k" style="color:var(--text-dim);min-width:70px">${esc(k)}</span><span class="v" style="color:var(--text);font-family:var(--font-mono);word-break:break-all">${esc(v || "—")}</span></div>`;

            const tick = async () => {
                if (!alive || busy) return;
                const name = $("#_dki_name").value.trim();
                if (!name) { $("#_dki_body").innerHTML = `<div style="color:var(--text-dim)">Enter a container name.</div>`; return; }
                busy = true;
                try {
                    const res = await window.dyo.exec("docker", ["inspect", "--format", FMT, name], { timeout: 8000 });
                    if (!res || res.code !== 0) {
                        const err = (res && (res.stderr || "")).toLowerCase();
                        let msg = "error";
                        if (err.includes("no such object") || err.includes("no such container")) msg = "no such container";
                        else if (err.includes("cannot connect") || err.includes("daemon")) msg = "daemon not running";
                        else if ((res && res.code === 127) || err.includes("not found")) msg = "docker not found";
                        $("#_dki_body").innerHTML = `<div style="color:var(--text-dim)">${esc(msg)}</div>`;
                        return;
                    }
                    const p = (res.stdout || "").split("\t");
                    $("#_dki_body").innerHTML =
                        rowHtml("image", (p[0] || "").trim()) +
                        rowHtml("ip", (p[1] || "").trim()) +
                        rowHtml("ports", (p[2] || "").trim()) +
                        rowHtml("status", (p[3] || "").trim());
                } catch (e) { $("#_dki_body").innerHTML = `<div style="color:var(--text-dim)">error</div>`; } finally { busy = false; }
            };

            const apply = () => { window.dyo.settings.set({ [SKEY]: $("#_dki_name").value.trim() }); tick(); };
            $("#_dki_go").addEventListener("click", apply);
            $("#_dki_name").addEventListener("keydown", e => { if (e.key === "Enter") apply(); });

            if (saved) tick(); else $("#_dki_body").innerHTML = `<div style="color:var(--text-dim)">Enter a container name.</div>`;
            const iv = setInterval(tick, 6000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
