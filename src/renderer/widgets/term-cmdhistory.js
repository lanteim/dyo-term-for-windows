"use strict";
window.I18N.register({
    en: { "widget.cmdhistory": "Command History", "cat.terminal": "Terminal", "ch.filter": "Filter history…", "ch.all": "All", "ch.showing": "showing", "ch.of": "of", "ch.empty": "History is empty.", "ch.nomatch": "No matches." },
    ru: { "widget.cmdhistory": "История команд", "cat.terminal": "Терминал", "ch.filter": "Фильтр…", "ch.all": "Все", "ch.showing": "показано", "ch.of": "из", "ch.empty": "История пуста.", "ch.nomatch": "Ничего не найдено." }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.cmdhistory = {
    id: "cmdhistory",
    title: "widget.cmdhistory",
    category: "terminal",
    description: "Shell history — 5/15/50/100/all, filter, click to run",
    defaultSize: { w: 6, h: 6 },
    mount(body) {
        const I = window.I18N, t = k => I.t(k);
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const LIMITS = [5, 15, 50, 100, "all"];
        let alive = true, all = [], limit = 5;

        body.innerHTML = `
            <div class="ch">
                <input class="ch-q" placeholder="${esc(t("ch.filter"))}" autocomplete="off" spellcheck="false">
                <div class="ch-btns"></div>
                <div class="ch-list"></div>
                <div class="ch-foot"></div>
            </div>`;
        const q = body.querySelector(".ch-q");
        const btns = body.querySelector(".ch-btns");
        const list = body.querySelector(".ch-list");
        const foot = body.querySelector(".ch-foot");

        // count buttons: 5 / 15 / 50 / 100 / All
        btns.innerHTML = LIMITS.map(n => `<button class="ch-b" data-n="${n}">${n === "all" ? esc(t("ch.all")) : n}</button>`).join("");
        btns.querySelectorAll(".ch-b").forEach(b => b.onclick = () => {
            limit = b.dataset.n === "all" ? "all" : Number(b.dataset.n);
            render();
        });

        function msg(text) { list.innerHTML = `<div class="ch-msg">${esc(text)}</div>`; foot.textContent = ""; }

        function parseZsh(content) {
            const out = [];
            for (const line of content.split("\n")) {
                if (!line) continue;
                const m = line.match(/^:\s*\d+:\d+;(.*)$/); // zsh extended: ": <ts>:<dur>;cmd"
                out.push(m ? m[1] : line);
            }
            return out;
        }

        function render() {
            btns.querySelectorAll(".ch-b").forEach(b => b.classList.toggle("on", (b.dataset.n === "all" ? "all" : Number(b.dataset.n)) === limit));
            const filter = q.value.trim().toLowerCase();
            const matched = filter ? all.filter(c => c.toLowerCase().includes(filter)) : all;
            if (!matched.length) { msg(filter ? t("ch.nomatch") : t("ch.empty")); return; }
            const rows = limit === "all" ? matched : matched.slice(0, limit);
            list.innerHTML = "";
            rows.forEach((cmd, i) => {
                const row = document.createElement("div");
                row.className = "ch-row";
                // number + full command that WRAPS (no truncation) so it's fully readable
                row.innerHTML = `<span class="ch-n">${i + 1}</span><span class="ch-cmd">${esc(cmd)}</span>`;
                row.title = "Click to type into the terminal";
                row.onclick = () => { if (window.term && window.term.runInFocused) window.term.runInFocused(cmd); };
                list.appendChild(row);
            });
            foot.textContent = `${t("ch.showing")} ${rows.length} ${t("ch.of")} ${matched.length}`;
        }

        async function load() {
            msg(t("ch.showing") + "…");
            let home = "";
            try { home = (await window.dyo.appInfo()).home; } catch (e) { }
            if (!home) { msg("home?"); return; }
            let content = null, isZsh = false;
            let r = await window.dyo.fs.read(home + "/.zsh_history", 2000000);
            if (r && r.content) { content = r.content; isZsh = true; }
            else { r = await window.dyo.fs.read(home + "/.bash_history", 2000000); if (r && r.content) content = r.content; }
            if (!alive) return;
            if (content == null) { msg("No .zsh_history / .bash_history"); return; }
            const parsed = isZsh ? parseZsh(content) : content.split("\n");
            const seen = new Set(), dedup = [];
            for (let i = parsed.length - 1; i >= 0; i--) { // newest first, dedup
                const c = (parsed[i] || "").trim();
                if (!c || seen.has(c)) continue;
                seen.add(c); dedup.push(c);
                if (dedup.length >= 5000) break;
            }
            all = dedup;
            render();
        }

        q.addEventListener("input", render);
        load();
        return { destroy: () => { alive = false; } };
    }
};
