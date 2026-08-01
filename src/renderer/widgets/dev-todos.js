"use strict";
window.I18N.register({
    en: { "widget.dev-todos": "TODO / FIXME", "cat.programming": "Programming" },
    ru: { "widget.dev-todos": "TODO / FIXME", "cat.programming": "Программирование" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS["dev-todos"] = {
    id: "dev-todos",
    title: "widget.dev-todos",
    category: "programming",
    description: "Scan project for TODO/FIXME/HACK comments",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <span id="_td_sum" style="font-size:11px;color:var(--text-dim)">scanning…</span>
                <button id="_td_re" style="margin-left:auto;font-size:11px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:2px 8px;cursor:pointer">↻</button>
            </div>
            <div id="_td_list" style="overflow:auto;max-height:calc(100% - 26px);font-family:var(--font-mono);font-size:12px"></div>`;
        const $ = s => body.querySelector(s);
        const sum = $("#_td_sum"), list = $("#_td_list");
        let alive = true, busy = false;
        const cwd = () => (window.term ? window.term.lastCwd : undefined);

        const parse = (out) => {
            const rows = [];
            for (const ln of out.split("\n")) {
                if (!ln.trim()) continue;
                // format: path:line:text
                const m = ln.match(/^(.*?):(\d+):(.*)$/);
                if (m) rows.push({ file: m[1], line: m[2], text: m[3] });
                if (rows.length >= 80) break;
            }
            return rows;
        };

        const render = (rows) => {
            if (!rows.length) {
                list.innerHTML = `<div style="color:var(--accent2);padding:6px">No TODO/FIXME/HACK found ✓</div>`;
                sum.textContent = "0 matches";
                return;
            }
            const tally = { TODO: 0, FIXME: 0, HACK: 0 };
            for (const r of rows) {
                const u = r.text.toUpperCase();
                if (u.includes("FIXME")) tally.FIXME++;
                else if (u.includes("HACK")) tally.HACK++;
                else tally.TODO++;
            }
            sum.textContent = `${rows.length} match${rows.length > 1 ? "es" : ""} · ${tally.TODO} TODO · ${tally.FIXME} FIXME · ${tally.HACK} HACK`;
            list.innerHTML = rows.map(r => {
                const u = r.text.toUpperCase();
                const col = u.includes("FIXME") ? "var(--danger)" : u.includes("HACK") ? "var(--accent2)" : "var(--accent)";
                const short = r.file.replace(/^\.\//, "");
                return `<div class="_td_row" data-file="${esc(r.file)}" style="display:flex;gap:8px;padding:3px 4px;border-bottom:1px solid var(--border);cursor:pointer" title="open ${esc(short)}">
                    <span style="color:var(--text-dim);flex:0 0 auto;white-space:nowrap">${esc(short)}:${esc(r.line)}</span>
                    <span style="color:${col};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.text.trim())}</span>
                </div>`;
            }).join("");
            list.querySelectorAll("._td_row").forEach(el => el.onclick = () => {
                let f = el.getAttribute("data-file");
                if (f && !f.startsWith("/") && cwd()) f = cwd() + "/" + f.replace(/^\.\//, "");
                if (f && window.dyo && window.dyo.openPath) window.dyo.openPath(f);
            });
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const c = cwd();
                if (!c) { list.innerHTML = `<div style="color:var(--text-dim);padding:6px">No project folder (focus a terminal in a project)</div>`; sum.textContent = "—"; return; }
                let res = await window.dyo.exec("rg", ["-n", "--no-heading", "-i", "-e", "TODO", "-e", "FIXME", "-e", "HACK"], { cwd: c, timeout: 8000 });
                if (!res || res.code === 127 || (res.stderr && /not found|no such file/i.test(res.stderr) && !res.stdout)) {
                    // fallback to grep -rn
                    res = await window.dyo.exec("grep", ["-rn", "-I", "-i", "-E", "(TODO|FIXME|HACK)", "."], { cwd: c, timeout: 8000 });
                }
                if (!res) { list.innerHTML = `<div style="color:var(--danger);padding:6px">scan failed</div>`; sum.textContent = "error"; return; }
                // rg exit 1 = no matches (fine); grep exit 1 = no matches too
                render(parse(res.stdout || ""));
            } catch (e) {
                list.innerHTML = `<div style="color:var(--danger);padding:6px">scan error</div>`;
            } finally { busy = false; }
        };
        $("#_td_re").onclick = tick;
        tick();
        const iv = setInterval(tick, 15000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
