"use strict";
window.I18N.register({
    en: { "widget.extra_quote": "Quote", "cat.ambient": "Ambient" },
    ru: { "widget.extra_quote": "Цитата", "cat.ambient": "Эмбиент" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.extra_quote = {
    id: "extra_quote",
    title: "widget.extra_quote",
    category: "ambient",
    description: "Random quote via quotable.io (offline fallback)",
    defaultSize: { w: 7, h: 3 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        let alive = true, busy = false;
        const FALLBACK = [
            { c: "Simplicity is the soul of efficiency.", a: "Austin Freeman" },
            { c: "Programs must be written for people to read, and only incidentally for machines to execute.", a: "Harold Abelson" },
            { c: "The best way to predict the future is to invent it.", a: "Alan Kay" },
            { c: "Talk is cheap. Show me the code.", a: "Linus Torvalds" },
            { c: "Premature optimization is the root of all evil.", a: "Donald Knuth" },
            { c: "Make it work, make it right, make it fast.", a: "Kent Beck" },
            { c: "First, solve the problem. Then, write the code.", a: "John Johnson" },
            { c: "It always seems impossible until it's done.", a: "Nelson Mandela" }
        ];

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;justify-content:center">
              <div class="_q" style="font-size:15px;line-height:1.45;color:var(--text)">…</div>
              <div class="_a" style="color:var(--accent2);text-align:right;font-size:12px"></div>
              <div style="display:flex;gap:6px;align-items:center">
                <button class="_ref">↻ New quote</button>
                <span class="_st" style="color:var(--text-dim);font-size:11px;margin-left:auto"></span>
              </div>
            </div>`;
        const $ = s => body.querySelector(s);
        $("._ref").style.cssText += ";background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;cursor:pointer;font-family:var(--font-mono)";

        const show = (c, a) => { $("._q").innerHTML = "“" + esc(c) + "”"; $("._a").textContent = a ? "— " + a : ""; };
        const fallback = () => { const q = FALLBACK[(Math.random() * FALLBACK.length) | 0]; show(q.c, q.a); $("._st").textContent = "offline"; };

        const load = async () => {
            if (busy || !alive) return;
            busy = true; $("._st").textContent = "…";
            const r = await window.dyo.http("https://api.quotable.io/random", { timeout: 7000 });
            busy = false;
            if (!alive) return;
            if (!r || r.error || !r.ok) { fallback(); return; }
            try {
                const d = JSON.parse(r.text);
                if (!d || !d.content) throw new Error("no content");
                show(d.content, d.author); $("._st").textContent = "quotable.io";
            } catch (e) { fallback(); }
        };
        $("._ref").onclick = load;
        load();

        return { destroy: () => { alive = false; } };
    }
};
