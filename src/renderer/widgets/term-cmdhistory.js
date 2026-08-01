"use strict";
window.I18N.register({
    en: { "widget.cmdhistory": "Command History", "cat.terminal": "Terminal" },
    ru: { "widget.cmdhistory": "История команд", "cat.terminal": "Терминал" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.cmdhistory = {
    id: "cmdhistory",
    title: "widget.cmdhistory",
    category: "terminal",
    description: "Search shell history; click to type a command",
    defaultSize: { w: 6, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        let alive = true;
        let all = [];

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px">
                <input id="_ch_q" placeholder="Filter history…" style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-elevated);color:var(--text);font-family:var(--font-ui);font-size:12px">
                <div id="_ch_list" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:2px"></div>
            </div>`;
        const q = body.querySelector("#_ch_q");
        const list = body.querySelector("#_ch_list");

        function msg(text) {
            list.innerHTML = `<div style="color:var(--text-dim);font-size:12px;padding:6px">${esc(text)}</div>`;
        }

        function parseZsh(content) {
            const out = [];
            for (let line of content.split("\n")) {
                if (!line) continue;
                // zsh extended format: ": <ts>:<dur>;cmd"
                const m = line.match(/^:\s*\d+:\d+;(.*)$/);
                out.push(m ? m[1] : line);
            }
            return out;
        }

        function render() {
            const filter = q.value.trim().toLowerCase();
            const rows = filter ? all.filter(c => c.toLowerCase().includes(filter)) : all;
            if (!rows.length) { msg(filter ? "No matches." : "History is empty."); return; }
            list.innerHTML = "";
            rows.slice(0, 200).forEach(cmd => {
                const row = document.createElement("div");
                row.textContent = cmd.length > 200 ? cmd.slice(0, 200) + "…" : cmd;
                row.title = "Click to type into terminal";
                row.style.cssText = "font-family:var(--font-mono);font-size:11.5px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:var(--bg-elevated)";
                row.onclick = () => { if (window.term) window.term.runInFocused(cmd); };
                list.appendChild(row);
            });
        }

        async function load() {
            msg("Loading history…");
            let home = "";
            try { home = (await window.dyo.appInfo()).home; } catch (e) { }
            if (!home) { msg("Could not resolve home directory."); return; }
            let content = null, isZsh = false;
            let r = await window.dyo.fs.read(home + "/.zsh_history", 1000000);
            if (r && r.content) { content = r.content; isZsh = true; }
            else {
                r = await window.dyo.fs.read(home + "/.bash_history", 1000000);
                if (r && r.content) content = r.content;
            }
            if (!alive) return;
            if (content == null) { msg("No .zsh_history or .bash_history found."); return; }
            const parsed = isZsh ? parseZsh(content) : content.split("\n");
            // newest first, dedup keeping first (newest) occurrence
            const seen = new Set();
            const dedup = [];
            for (let i = parsed.length - 1; i >= 0; i--) {
                const c = (parsed[i] || "").trim();
                if (!c || seen.has(c)) continue;
                seen.add(c);
                dedup.push(c);
                if (dedup.length >= 200) break;
            }
            all = dedup;
            render();
        }

        q.addEventListener("input", render);
        load();
        return { destroy: () => { alive = false; } };
    }
};
