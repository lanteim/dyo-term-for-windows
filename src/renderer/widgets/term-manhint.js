"use strict";
window.I18N.register({
    en: { "widget.manhint": "Man Hint", "cat.terminal": "Terminal" },
    ru: { "widget.manhint": "Подсказка man", "cat.terminal": "Терминал" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.manhint = {
    id: "manhint",
    title: "widget.manhint",
    category: "terminal",
    description: "Quick tldr/whatis lookup for a command",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        let alive = true, busy = false;

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px">
                <form id="_mh_form" style="display:flex;gap:6px">
                    <input id="_mh_q" placeholder="Command name, e.g. tar" style="flex:1;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-elevated);color:var(--text);font-family:var(--font-mono);font-size:12px">
                    <button type="submit" style="border:1px solid var(--border);background:var(--bg-elevated);color:var(--accent);border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px">Look up</button>
                </form>
                <pre id="_mh_out" style="flex:1;overflow:auto;margin:0;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-elevated);font-family:var(--font-mono);font-size:11.5px;color:var(--text);white-space:pre-wrap;word-break:break-word"></pre>
            </div>`;
        const form = body.querySelector("#_mh_form");
        const q = body.querySelector("#_mh_q");
        const out = body.querySelector("#_mh_out");

        function show(text, dim) {
            out.innerHTML = `<span style="${dim ? "color:var(--text-dim)" : ""}">${esc(text)}</span>`;
        }
        show("Enter a command name to see a quick reference.", true);

        async function lookup(name) {
            if (busy) return;
            busy = true;
            show("Looking up " + name + "…", true);
            try {
                let r = await window.dyo.exec("tldr", [name], { timeout: 8000 });
                if (!alive) return;
                if (r && r.code === 0 && r.stdout && r.stdout.trim()) { show(r.stdout.trim()); return; }
                let r2 = await window.dyo.exec("whatis", [name], { timeout: 8000 });
                if (!alive) return;
                if (r2 && r2.code === 0 && r2.stdout && r2.stdout.trim()) { show(r2.stdout.trim()); return; }
                if (r2 && r2.stderr && r2.stderr.trim()) { show(r2.stderr.trim(), true); return; }
                show("No tldr or whatis entry found (are tldr/whatis installed?).", true);
            } catch (e) {
                if (alive) show("Lookup failed: " + (e && e.message ? e.message : e), true);
            } finally {
                busy = false;
            }
        }

        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const name = q.value.trim();
            if (!name) return;
            lookup(name);
        });

        return { destroy: () => { alive = false; } };
    }
};
