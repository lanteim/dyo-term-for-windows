"use strict";
window.I18N.register({
    en: { "widget.dev-loc": "Code Stats", "cat.programming": "Programming" },
    ru: { "widget.dev-loc": "Статистика кода", "cat.programming": "Программирование" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS["dev-loc"] = {
    id: "dev-loc",
    title: "widget.dev-loc",
    category: "programming",
    description: "File count & top extensions in project",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">FILES</span><span class="v"><b id="_loc_n">—</b></span></div>
            <div id="_loc_list" style="overflow:auto;max-height:calc(100% - 34px);margin-top:4px"></div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const cwd = () => (window.term ? window.term.lastCwd : undefined);

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const c = cwd();
                if (!c) { $("#_loc_n").textContent = "—"; $("#_loc_list").innerHTML = `<div style="color:var(--text-dim)">No project folder</div>`; return; }
                const res = await window.dyo.exec("find", [".", "-type", "f", "-not", "-path", "*/node_modules/*", "-not", "-path", "*/.git/*", "-not", "-path", "*/dist/*", "-not", "-path", "*/build/*"], { cwd: c, timeout: 8000 });
                if (!res || res.code !== 0) { $("#_loc_list").innerHTML = `<div style="color:var(--danger)">find failed</div>`; return; }
                const files = (res.stdout || "").split("\n").filter(l => l.trim());
                $("#_loc_n").textContent = files.length.toLocaleString(window.I18N.locale());
                const tally = {};
                for (const f of files) {
                    const base = f.split("/").pop();
                    let ext;
                    if (base.startsWith(".") && base.indexOf(".", 1) === -1) ext = base; // dotfile
                    else if (base.includes(".")) ext = "." + base.split(".").pop();
                    else ext = "(none)";
                    if (ext.length > 12) ext = "(none)";
                    tally[ext] = (tally[ext] || 0) + 1;
                }
                const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 10);
                const max = top.length ? top[0][1] : 1;
                $("#_loc_list").innerHTML = top.map(([ext, n]) => {
                    const w = Math.round((n / max) * 100);
                    return `<div style="margin-bottom:5px">
                        <div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:11px">
                            <span style="color:var(--accent)">${esc(ext)}</span><span class="v">${n}</span>
                        </div>
                        <div class="bar" style="width:100%"><i style="width:${w}%"></i></div>
                    </div>`;
                }).join("");
            } catch (e) {
                $("#_loc_list").innerHTML = `<div style="color:var(--danger)">error</div>`;
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 12000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
