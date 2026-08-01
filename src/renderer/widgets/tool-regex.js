"use strict";
window.I18N.register({
    en: { "widget.tool_regex": "Regex Tester", "cat.tools": "Tools" },
    ru: { "widget.tool_regex": "Тестер Regex", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.tool_regex = {
    id: "tool_regex",
    title: "widget.tool_regex",
    category: "tools",
    description: "Live regex matcher with capture groups",
    defaultSize: { w: 8, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:12px";
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:6px;height:100%">
                <div style="display:flex;gap:6px;align-items:center">
                    <span style="color:var(--text-dim)">/</span>
                    <input class="rx-pat" placeholder="pattern" style="${inp};flex:1" />
                    <span style="color:var(--text-dim)">/</span>
                    <input class="rx-flags" placeholder="gim" value="g" style="${inp};width:64px" />
                </div>
                <textarea class="rx-text" placeholder="test text…" style="${inp};flex:1;resize:none;min-height:48px" spellcheck="false"></textarea>
                <div class="rx-status" style="font-size:11px;color:var(--text-dim);min-height:14px"></div>
                <div class="rx-hl" style="${inp};flex:1;overflow:auto;white-space:pre-wrap;word-break:break-word;background:var(--bg-elevated)"></div>
                <div class="rx-groups" style="flex:1;overflow:auto;font-size:11px"></div>
            </div>`;
        const pat = body.querySelector(".rx-pat");
        const flg = body.querySelector(".rx-flags");
        const txt = body.querySelector(".rx-text");
        const status = body.querySelector(".rx-status");
        const hl = body.querySelector(".rx-hl");
        const groups = body.querySelector(".rx-groups");
        txt.value = "Contact: alice@example.com, bob@test.io";
        pat.value = "(\\w+)@([\\w.]+)";

        const run = () => {
            const p = pat.value;
            const source = txt.value;
            if (!p) { status.textContent = "Enter a pattern"; hl.innerHTML = esc(source); groups.innerHTML = ""; return; }
            let flags = (flg.value || "").replace(/[^gimsuy]/g, "");
            if (flags.indexOf("g") < 0) flags += "g";
            let re;
            try { re = new RegExp(p, flags); } catch (e) {
                status.innerHTML = `<span style="color:var(--danger)">Invalid: ${esc(e.message)}</span>`;
                hl.innerHTML = esc(source); groups.innerHTML = ""; return;
            }
            let out = "", last = 0, count = 0, m, guard = 0;
            const rows = [];
            while ((m = re.exec(source)) !== null) {
                if (guard++ > 5000) break;
                const start = m.index, end = start + m[0].length;
                out += esc(source.slice(last, start));
                out += `<mark style="background:var(--accent);color:var(--bg-elevated);border-radius:3px">${esc(m[0]) || "∅"}</mark>`;
                last = end;
                count++;
                let g = "";
                for (let i = 1; i < m.length; i++) g += `<span style="color:var(--accent2)">$${i}</span>=${esc(m[i] == null ? "∅" : m[i])} `;
                rows.push(`<div class="metric-row"><span class="k">#${count}</span><span class="v">${esc(m[0])}${g ? " → " + g : ""}</span></div>`);
                if (m[0].length === 0) re.lastIndex++;
            }
            out += esc(source.slice(last));
            hl.innerHTML = out || `<span style="color:var(--text-dim)">(empty)</span>`;
            status.innerHTML = count ? `<span style="color:var(--accent)">${count} match${count > 1 ? "es" : ""}</span>` : `<span style="color:var(--text-dim)">No matches</span>`;
            groups.innerHTML = rows.join("") || "";
        };
        pat.oninput = run;
        flg.oninput = run;
        txt.oninput = run;
        run();
        return { destroy() { pat.oninput = flg.oninput = txt.oninput = null; } };
    }
};
