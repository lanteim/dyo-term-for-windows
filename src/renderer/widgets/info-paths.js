"use strict";
window.I18N.register({
    en: { "widget.info_paths": "PATH", "cat.system": "System" },
    ru: { "widget.info_paths": "PATH", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.info_paths = {
        id: "info_paths",
        title: "widget.info_paths",
        category: "system",
        description: "$PATH entries as a scrollable list",
        defaultSize: { w: 6, h: 4 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🧭 PATH</span>
                    <b class="_n" style="color:var(--accent)">—</b>
                    <button class="_copy" style="margin-left:auto;background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:3px 9px;cursor:pointer;font-size:11px">Copy all</button>
                  </div>
                  <div class="_msg" style="color:var(--text-dim);font-size:11px;display:none"></div>
                  <div class="_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px"></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false, raw = "";

            $("._copy").onclick = () => { if (raw) navigator.clipboard.writeText(raw).catch(() => {}); };

            const render = (dirs) => {
                if (!dirs.length) { $("._body").innerHTML = `<div style="color:var(--text-dim);padding:10px">PATH empty.</div>`; return; }
                let h = "";
                dirs.forEach((d, i) => {
                    h += `<div class="_row" data-p="${esc(d)}" title="Click to copy" style="padding:4px 9px;border-top:${i ? '1px solid var(--border)' : 'none'};font-family:var(--font-mono);font-size:11.5px;color:var(--text);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                        <span style="color:var(--text-dim)">${String(i + 1).padStart(2, '0')}</span>  ${esc(d)}</div>`;
                });
                $("._body").innerHTML = h;
                $("._body").querySelectorAll("._row").forEach(el => {
                    el.onclick = () => navigator.clipboard.writeText(el.getAttribute("data-p")).catch(() => {});
                });
            };

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const r = await window.dyo.exec("printenv", ["PATH"], { timeout: 6000 });
                    if (!alive) return;
                    const out = r && r.stdout ? r.stdout.trim() : "";
                    if (!out) {
                        $("._msg").style.display = "block";
                        $("._msg").innerHTML = `<span style="color:var(--danger)">PATH unavailable</span>`;
                        $("._n").textContent = "0";
                        $("._body").innerHTML = `<div style="color:var(--text-dim);padding:10px">No PATH.</div>`;
                        raw = "";
                        return;
                    }
                    raw = out;
                    const dirs = out.split(":").map(x => x.trim()).filter(Boolean);
                    $("._msg").style.display = "none";
                    $("._n").textContent = dirs.length;
                    render(dirs);
                } catch (e) {
                    if (alive) { $("._msg").style.display = "block"; $("._msg").innerHTML = `<span style="color:var(--danger)">error</span>`; }
                } finally { busy = false; }
            };
            tick();
            return { destroy: () => { alive = false; } };
        }
    };
})();
