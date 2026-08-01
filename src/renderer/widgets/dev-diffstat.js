"use strict";
window.I18N.register({
    en: { "widget.dev-diffstat": "Git Diffstat", "cat.programming": "Programming" },
    ru: { "widget.dev-diffstat": "Git Diffstat", "cat.programming": "Программирование" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS["dev-diffstat"] = {
    id: "dev-diffstat",
    title: "widget.dev-diffstat",
    category: "programming",
    description: "Working tree & staged diff stats per file",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;gap:6px;margin-bottom:6px;font-size:11px">
                <button class="_ds_tab" data-m="wt" style="background:var(--accent);color:#000;border:none;border-radius:4px;padding:2px 8px;cursor:pointer">Working</button>
                <button class="_ds_tab" data-m="idx" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:2px 8px;cursor:pointer">Staged</button>
                <span id="_ds_sum" style="margin-left:auto;color:var(--text-dim);align-self:center"></span>
            </div>
            <div id="_ds_body" style="overflow:auto;max-height:calc(100% - 28px);font-family:var(--font-mono);font-size:12px"></div>`;
        const $ = s => body.querySelector(s);
        const bodyEl = $("#_ds_body"), sumEl = $("#_ds_sum");
        let alive = true, busy = false, mode = "wt";
        const git = (args) => window.dyo.exec("git", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 5000 });

        const render = (out) => {
            const lines = out.split("\n").filter(l => l.trim());
            const files = [];
            for (const l of lines) {
                // " path | 12 +++--" ; last summary line " N files changed, ..."
                const m = l.match(/^\s*(.+?)\s+\|\s+(\d+|Bin)\s*(.*)$/);
                if (m) {
                    const plus = (m[3].match(/\+/g) || []).length;
                    const minus = (m[3].match(/-/g) || []).length;
                    files.push({ name: m[1].trim(), count: m[2], plus, minus, bin: m[2] === "Bin" });
                }
            }
            const summary = lines.find(l => /changed/.test(l)) || "";
            if (!files.length) {
                bodyEl.innerHTML = `<div style="color:var(--accent2);padding:6px">${mode === "wt" ? "working tree clean ✓" : "nothing staged"}</div>`;
                sumEl.textContent = "";
                return;
            }
            sumEl.textContent = summary.trim();
            const maxc = Math.max(1, ...files.map(f => (f.plus + f.minus) || 0));
            bodyEl.innerHTML = files.map(f => {
                const total = f.plus + f.minus;
                const w = Math.round((total / maxc) * 100);
                const pPct = total ? Math.round((f.plus / total) * 100) : 0;
                return `<div style="padding:3px 2px;border-bottom:1px solid var(--border)">
                    <div style="display:flex;justify-content:space-between;gap:8px">
                        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(f.name)}">${esc(f.name)}</span>
                        <span style="flex:0 0 auto;color:var(--text-dim)">${f.bin ? "Bin" : `<span style="color:var(--accent2)">+${f.plus}</span> <span style="color:var(--danger)">-${f.minus}</span>`}</span>
                    </div>
                    <div class="bar" style="margin-top:3px;width:${w}%;min-width:8px;background:var(--danger)"><i style="width:${pPct}%;background:var(--accent2)"></i></div>
                </div>`;
            }).join("");
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const inside = await git(["rev-parse", "--is-inside-work-tree"]);
                if (!inside || inside.code !== 0 || inside.stdout.trim() !== "true") {
                    bodyEl.innerHTML = `<div style="color:var(--text-dim);padding:6px">not a git repository</div>`;
                    sumEl.textContent = "";
                    return;
                }
                const args = mode === "idx" ? ["diff", "--stat", "--cached"] : ["diff", "--stat"];
                const res = await git(args);
                if (!res || res.code !== 0) { bodyEl.innerHTML = `<div style="color:var(--danger);padding:6px">git diff failed</div>`; return; }
                render(res.stdout || "");
            } finally { busy = false; }
        };

        body.querySelectorAll("._ds_tab").forEach(btn => btn.onclick = () => {
            mode = btn.getAttribute("data-m");
            body.querySelectorAll("._ds_tab").forEach(b => {
                const active = b === btn;
                b.style.background = active ? "var(--accent)" : "var(--bg-elevated)";
                b.style.color = active ? "#000" : "var(--text)";
                b.style.border = active ? "none" : "1px solid var(--border)";
            });
            tick();
        });
        tick();
        const iv = setInterval(tick, 4000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
