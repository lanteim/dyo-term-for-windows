"use strict";
window.I18N.register({
    en: { "widget.extra_quote": "Quote", "cat.ambient": "Ambient", "quote.new": "↻ New quote", "quote.local": "offline" },
    ru: { "widget.extra_quote": "Цитата", "cat.ambient": "Эмбиент", "quote.new": "↻ Новая цитата", "quote.local": "локально" }
});
window.WIDGETS = window.WIDGETS || {};

// Bundled quotes per language so the CONTENT is localized, not just the title.
const QUOTES = {
    en: [
        { c: "Simplicity is the soul of efficiency.", a: "Austin Freeman" },
        { c: "Programs must be written for people to read, and only incidentally for machines to execute.", a: "Harold Abelson" },
        { c: "The best way to predict the future is to invent it.", a: "Alan Kay" },
        { c: "Talk is cheap. Show me the code.", a: "Linus Torvalds" },
        { c: "Premature optimization is the root of all evil.", a: "Donald Knuth" },
        { c: "Make it work, make it right, make it fast.", a: "Kent Beck" },
        { c: "First, solve the problem. Then, write the code.", a: "John Johnson" },
        { c: "It always seems impossible until it's done.", a: "Nelson Mandela" },
        { c: "Any fool can write code that a computer understands. Good programmers write code that humans understand.", a: "Martin Fowler" },
        { c: "Code is like humor. When you have to explain it, it's bad.", a: "Cory House" }
    ],
    ru: [
        { c: "Простота — душа эффективности.", a: "Остин Фримен" },
        { c: "Программы должны писаться для того, чтобы их читали люди, и лишь попутно — чтобы их исполняли машины.", a: "Гарольд Абельсон" },
        { c: "Лучший способ предсказать будущее — придумать его.", a: "Алан Кэй" },
        { c: "Болтовня ничего не стоит. Покажи мне код.", a: "Линус Торвальдс" },
        { c: "Преждевременная оптимизация — корень всех зол.", a: "Дональд Кнут" },
        { c: "Сначала заставь работать, потом сделай правильно, потом — быстро.", a: "Кент Бек" },
        { c: "Сначала реши задачу. Потом пиши код.", a: "Джон Джонсон" },
        { c: "Всё всегда кажется невозможным, пока не будет сделано.", a: "Нельсон Мандела" },
        { c: "Любой дурак способен написать код, понятный компьютеру. Хорошие программисты пишут код, понятный людям.", a: "Мартин Фаулер" },
        { c: "Код — как шутка: если его нужно объяснять, он плохой.", a: "Кори Хаус" },
        { c: "Опыт — это имя, которое каждый даёт своим ошибкам.", a: "Оскар Уайльд" },
        { c: "Не бойся совершенства — тебе его не достичь.", a: "Сальвадор Дали" }
    ]
};

window.WIDGETS.extra_quote = {
    id: "extra_quote",
    title: "widget.extra_quote",
    category: "ambient",
    description: "Random quote — localized (EN/RU), offline",
    defaultSize: { w: 7, h: 3 },
    mount(body) {
        const I = window.I18N;
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        let alive = true, busy = false;

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;justify-content:center">
              <div class="_q" style="font-size:15px;line-height:1.45;color:var(--text)">…</div>
              <div class="_a" style="color:var(--accent2);text-align:right;font-size:12px"></div>
              <div style="display:flex;gap:6px;align-items:center">
                <button class="_ref">${I.t("quote.new")}</button>
                <span class="_st" style="color:var(--text-dim);font-size:11px;margin-left:auto"></span>
              </div>
            </div>`;
        const $ = s => body.querySelector(s);
        $("._ref").style.cssText += ";background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;cursor:pointer;font-family:var(--font-mono)";

        const show = (c, a) => { $("._q").innerHTML = "“" + esc(c) + "”"; $("._a").textContent = a ? "— " + a : ""; };
        const localList = () => QUOTES[I.lang] || QUOTES.en;
        const localQuote = () => { const l = localList(); const q = l[(Math.random() * l.length) | 0]; show(q.c, q.a); $("._st").textContent = I.t("quote.local"); };

        const load = async () => {
            if (busy || !alive) return;
            // Russian (and any non-English) UI → localized bundled quotes, no English API.
            if (I.lang !== "en") { localQuote(); return; }
            busy = true; $("._st").textContent = "…";
            const r = await window.dyo.http("https://api.quotable.io/random", { timeout: 7000 });
            busy = false;
            if (!alive) return;
            if (!r || r.error || !r.ok) { localQuote(); return; }
            try {
                const d = JSON.parse(r.text);
                if (!d || !d.content) throw new Error("no content");
                show(d.content, d.author); $("._st").textContent = "quotable.io";
            } catch (e) { localQuote(); }
        };
        $("._ref").onclick = load;
        load();

        // Re-pick in the new language when the user switches languages.
        const onLang = () => { if (!alive) return; $("._ref").textContent = I.t("quote.new"); load(); };
        I.onChange(onLang);

        // I18N.onChange has no removal API, so the listener stays registered forever;
        // drop the closure's ref to the widget DOM so destroy() releases the detached tree.
        return { destroy: () => { alive = false; body = null; } };
    }
};
