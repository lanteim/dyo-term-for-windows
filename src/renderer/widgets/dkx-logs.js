"use strict";
window.I18N.register({
    en: { "widget.dkx_logs": "Docker Logs", "cat.docker": "Docker" },
    ru: { "widget.dkx_logs": "Docker логи", "cat.docker": "Docker" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
    const SKEY = "dkx_logs.container";

    window.WIDGETS.dkx_logs = {
        id: "dkx_logs",
        title: "widget.dkx_logs",
        category: "docker",
        description: "Tail docker logs for a container",
        defaultSize: { w: 12, h: 4 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:6px">
                    <span style="color:var(--text-dim)">🐳 LOGS</span>
                    <input id="_dkl_name" placeholder="container name or id"
                      style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);flex:1;min-width:80px">
                    <button id="_dkl_go" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:5px 10px;cursor:pointer">Tail</button>
                    <span id="_dkl_msg" style="color:var(--text-dim)"></span>
                  </div>
                  <pre id="_dkl_out" style="flex:1;overflow:auto;margin:0;border:1px solid var(--border);border-radius:6px;padding:8px;font-family:var(--font-mono);font-size:11px;white-space:pre-wrap;color:var(--text)">…</pre>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const tick = async () => {
                if (!alive || busy) return;
                const name = $("#_dkl_name").value.trim();
                if (!name) { $("#_dkl_out").textContent = "Enter a container name and press Tail."; $("#_dkl_msg").textContent = ""; return; }
                busy = true;
                try {
                    const res = await window.dyo.exec("docker", ["logs", "--tail", "60", name], { timeout: 9000 });
                    if (!res) { $("#_dkl_msg").textContent = "docker unavailable"; return; }
                    if (res.code !== 0) {
                        const err = (res.stderr || "").toLowerCase();
                        let msg = "error";
                        if (err.includes("no such container")) msg = "no such container";
                        else if (err.includes("cannot connect") || err.includes("daemon")) msg = "daemon not running";
                        else if (res.code === 127 || err.includes("not found")) msg = "docker not found";
                        $("#_dkl_msg").textContent = msg;
                        $("#_dkl_out").textContent = (res.stderr || "").trim() || msg;
                        return;
                    }
                    $("#_dkl_msg").textContent = "";
                    const out = (res.stdout || "") + (res.stderr || "");
                    $("#_dkl_out").textContent = out.trim() || "(no log output)";
                    $("#_dkl_out").scrollTop = $("#_dkl_out").scrollHeight;
                } catch (e) { $("#_dkl_msg").textContent = "error"; } finally { busy = false; }
            };

            const apply = () => { window.dyo.settings.set({ [SKEY]: $("#_dkl_name").value.trim() }); tick(); };
            $("#_dkl_go").addEventListener("click", apply);
            $("#_dkl_name").addEventListener("keydown", e => { if (e.key === "Enter") apply(); });

            window.dyo.settings.get().then(s => {
                if (!alive) return;
                const saved = (s && s[SKEY]) ? String(s[SKEY]) : "";
                $("#_dkl_name").value = saved;
                if (saved) tick(); else $("#_dkl_out").textContent = "Enter a container name and press Tail.";
            });
            const iv = setInterval(tick, 5000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
