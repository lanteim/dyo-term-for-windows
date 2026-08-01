"use strict";
window.I18N.register({
    en: { "widget.tool_markdown": "Markdown Preview", "cat.tools": "Tools" },
    ru: { "widget.tool_markdown": "Просмотр Markdown", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.tool_markdown = {
    id: "tool_markdown",
    title: "widget.tool_markdown",
    category: "tools",
    description: "Live minimal Markdown preview",
    defaultSize: { w: 9, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono);font-size:12px";
        body.innerHTML = `
            <div style="display:flex;gap:8px;height:100%">
                <textarea class="md-in" style="${inp};flex:1;resize:none" spellcheck="false"></textarea>
                <div class="md-out" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:8px;background:var(--bg-elevated);font-size:13px;line-height:1.5"></div>
            </div>`;
        const min = body.querySelector(".md-in");
        const mout = body.querySelector(".md-out");
        min.value = "# Hello\n\nSome **bold**, *italic*, and `code`.\n\n- one\n- two\n\n[link](https://example.com)";

        const inline = t => {
            // t is already HTML-escaped
            t = t.replace(/`([^`]+)`/g, '<code style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:4px;padding:0 4px;font-family:var(--font-mono);font-size:0.9em">$1</code>');
            t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
            t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" style="color:var(--accent)" data-md-link="$2">$1</a>');
            return t;
        };
        const render = () => {
            const lines = min.value.split("\n");
            let html = "", listOpen = false, i = 0;
            const closeList = () => { if (listOpen) { html += "</ul>"; listOpen = false; } };
            while (i < lines.length) {
                const raw = lines[i];
                const line = esc(raw);
                let m;
                if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
                    closeList();
                    const lvl = m[1].length;
                    const sz = [1.5, 1.35, 1.2, 1.1, 1, 0.95][lvl - 1];
                    html += `<h${lvl} style="font-size:${sz}em;margin:.4em 0 .2em">${inline(m[2])}</h${lvl}>`;
                } else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
                    if (!listOpen) { html += '<ul style="margin:.2em 0 .2em 1.2em">'; listOpen = true; }
                    html += `<li>${inline(m[1])}</li>`;
                } else if (line.trim() === "") {
                    closeList();
                } else {
                    closeList();
                    html += `<p style="margin:.3em 0">${inline(line)}</p>`;
                }
                i++;
            }
            closeList();
            mout.innerHTML = html || `<span style="color:var(--text-dim)">preview…</span>`;
            mout.querySelectorAll("a[data-md-link]").forEach(el => {
                el.onclick = ev => {
                    ev.preventDefault();
                    if (window.dyo && window.dyo.openExternal) window.dyo.openExternal(el.getAttribute("data-md-link"));
                };
            });
        };
        min.oninput = render;
        render();
        return { destroy() { min.oninput = null; } };
    }
};
