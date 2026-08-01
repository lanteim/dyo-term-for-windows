"use strict";
window.I18N.register({
    en: { "widget.ct_composelogs": "Compose Logs", "cat.docker": "Docker" },
    ru: { "widget.ct_composelogs": "Compose Логи", "cat.docker": "Docker" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
    const SKEY = "ct_composelogs.service";

    window.WIDGETS.ct_composelogs = {
        id: "ct_composelogs",
        title: "widget.ct_composelogs",
        category: "docker",
        description: "docker compose logs --tail 40 for a service (cwd)",
        defaultSize: { w: 7, h: 4 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">📜 COMPOSE LOGS</span>
                    <span id="_ctcolg_svc" style="color:var(--accent);font-variant-numeric:tabular-nums"></span>
                    <span id="_ctcolg_msg" style="color:var(--text-dim);margin-left:auto"></span>
                    <button id="_ctcolg_cfg" title="settings" style="background:none;border:1px solid var(--border);color:var(--text-dim);border-radius:4px;cursor:pointer;padding:1px 6px">⚙</button>
                  </div>
                  <div id="_ctcolg_form" style="display:none"></div>
                  <pre id="_ctcolg_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:6px;margin:0;white-space:pre-wrap;word-break:break-word;font-family:var(--font-mono);font-size:11px;line-height:1.35"></pre>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const getSvc = () => {
                try {
                    const st = window.dyo.settings.get ? window.dyo.settings.get() : null;
                    return (st && st[SKEY]) ? String(st[SKEY]) : "";
                } catch (e) { return ""; }
            };

            const showForm = () => {
                const cur = getSvc();
                $("#_ctcolg_form").style.display = "block";
                $("#_ctcolg_form").innerHTML = `
                    <div style="display:flex;gap:6px;align-items:center;padding:4px;border:1px solid var(--border);border-radius:6px;background:var(--bg-elevated)">
                      <input id="_ctcolg_in" placeholder="service name (e.g. web, api, db)" value="${esc(cur)}"
                        style="flex:1;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:12px;font-family:var(--font-mono)"/>
                      <button id="_ctcolg_save" style="background:var(--accent);border:none;color:#000;border-radius:4px;cursor:pointer;padding:3px 10px">Save</button>
                    </div>
                    <div style="color:var(--text-dim);font-size:10.5px;padding:3px 4px">Runs <code>docker compose logs --tail 40 &lt;service&gt;</code> in the focused tab's directory.</div>`;
                const inp = $("#_ctcolg_in");
                inp.focus();
                const save = () => {
                    const val = inp.value.trim();
                    try { window.dyo.settings.set({ [SKEY]: val }); } catch (e) { }
                    $("#_ctcolg_form").style.display = "none";
                    $("#_ctcolg_form").innerHTML = "";
                    render();
                    tick();
                };
                $("#_ctcolg_save").addEventListener("click", save);
                inp.addEventListener("keydown", e => { if (e.key === "Enter") save(); });
            };

            const render = () => {
                const svc = getSvc();
                $("#_ctcolg_svc").textContent = svc ? svc : "";
                if (!svc) {
                    $("#_ctcolg_body").textContent = "";
                    $("#_ctcolg_body").innerHTML = `<span style="color:var(--text-dim)">No service configured. Click ⚙ to set one.</span>`;
                }
            };

            const diagnose = (res) => {
                const err = ((res && (res.stderr || "")) || "").toLowerCase();
                if (!res || res.code === 127 || err.includes("not found") || err.includes("is not a docker command")) return "docker compose not available";
                if (err.includes("cannot connect") || err.includes("daemon")) return "docker daemon not running";
                if (err.includes("no such service") || err.includes("no configuration file") || err.includes("no such file")) return "no compose project / service here";
                return (res && res.stderr ? res.stderr.trim().split("\n").slice(-2).join(" ") : "compose logs unavailable");
            };

            const tick = async () => {
                if (!alive || busy) return;
                const svc = getSvc();
                if (!svc) return;
                busy = true;
                try {
                    const cwd = window.term ? window.term.lastCwd : undefined;
                    $("#_ctcolg_msg").textContent = "…";
                    const res = await window.dyo.exec("docker", ["compose", "logs", "--no-color", "--tail", "40", svc], { cwd, timeout: 10000 });
                    $("#_ctcolg_msg").textContent = "";
                    if (!res || res.code !== 0) {
                        $("#_ctcolg_body").innerHTML = `<span style="color:var(--text-dim)">${esc(diagnose(res))}</span>`;
                        return;
                    }
                    const out = (res.stdout || "").replace(/\s+$/, "");
                    if (!out) {
                        $("#_ctcolg_body").innerHTML = `<span style="color:var(--text-dim)">no log lines for "${esc(svc)}"</span>`;
                        return;
                    }
                    const lines = out.split("\n").slice(-40);
                    $("#_ctcolg_body").textContent = lines.join("\n");
                    // autoscroll to bottom
                    $("#_ctcolg_body").scrollTop = $("#_ctcolg_body").scrollHeight;
                } catch (e) {
                    $("#_ctcolg_msg").textContent = "error";
                } finally { busy = false; }
            };

            $("#_ctcolg_cfg").addEventListener("click", () => {
                const f = $("#_ctcolg_form");
                if (f.style.display === "none") showForm();
                else { f.style.display = "none"; f.innerHTML = ""; }
            });

            render();
            if (getSvc()) tick(); else showForm();
            const iv = setInterval(tick, 5000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
