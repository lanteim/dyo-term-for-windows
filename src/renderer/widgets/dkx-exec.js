"use strict";
window.I18N.register({
    en: { "widget.dkx_exec": "Docker Exec", "cat.docker": "Docker" },
    ru: { "widget.dkx_exec": "Docker Exec", "cat.docker": "Docker" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.dkx_exec = {
        id: "dkx_exec",
        title: "widget.dkx_exec",
        category: "docker",
        description: "Open a shell into a running container",
        defaultSize: { w: 12, h: 4 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🐳 EXEC SHELL</span>
                    <b id="_dke_n" style="color:var(--accent)">—</b>
                    <span id="_dke_msg" style="color:var(--text-dim);margin-left:auto"></span>
                  </div>
                  <div id="_dke_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px"><div style="color:var(--text-dim);padding:10px">Loading…</div></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const render = (rows) => {
                if (!rows.length) { $("#_dke_body").innerHTML = `<div style="color:var(--text-dim);padding:10px">No running containers.</div>`; return; }
                const wrap = document.createElement("div");
                wrap.style.cssText = "display:flex;flex-direction:column";
                rows.slice(0, 200).forEach(r => {
                    const row = document.createElement("div");
                    row.style.cssText = "display:flex;align-items:center;gap:8px;padding:5px 8px;border-top:1px solid var(--border)";
                    const info = document.createElement("div");
                    info.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-mono);font-size:11.5px";
                    info.innerHTML = `<span style="color:var(--text)">${esc(r.name)}</span> <span style="color:var(--text-dim)">${esc(r.image)}</span>`;
                    const btn = document.createElement("button");
                    btn.textContent = "sh";
                    btn.title = "Open a shell (docker exec -it) in " + r.name;
                    btn.style.cssText = "background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:4px 12px;cursor:pointer;flex:none";
                    btn.addEventListener("click", () => {
                        window.term.runInFocused("docker exec -it " + r.id + " sh\n");
                    });
                    row.appendChild(info); row.appendChild(btn); wrap.appendChild(row);
                });
                $("#_dke_body").innerHTML = ""; $("#_dke_body").appendChild(wrap);
            };

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const res = await window.dyo.exec("docker", ["ps", "--format", "{{.ID}}\t{{.Names}}\t{{.Image}}"], { timeout: 8000 });
                    if (!res || res.code !== 0) {
                        const err = (res && (res.stderr || "")).toLowerCase();
                        let msg = "docker not available";
                        if (err.includes("cannot connect") || err.includes("daemon")) msg = "daemon not running";
                        else if (err.includes("not found") || (res && res.code === 127)) msg = "docker not found";
                        $("#_dke_msg").textContent = msg; $("#_dke_n").textContent = "—";
                        $("#_dke_body").innerHTML = `<div style="color:var(--text-dim);padding:10px">${esc(msg)}</div>`;
                        return;
                    }
                    $("#_dke_msg").textContent = "";
                    const rows = res.stdout.split("\n").filter(l => l.trim()).map(l => {
                        const p = l.split("\t"); return { id: p[0] || "", name: p[1] || "", image: p[2] || "" };
                    });
                    $("#_dke_n").textContent = rows.length;
                    render(rows);
                } catch (e) { $("#_dke_msg").textContent = "error"; } finally { busy = false; }
            };
            tick();
            const iv = setInterval(tick, 5000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
