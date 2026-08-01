"use strict";
window.I18N.register({
    en: { "widget.ref2_emoji": "Emoji Picker", "cat.reference": "Reference" },
    ru: { "widget.ref2_emoji": "Выбор эмодзи", "cat.reference": "Справочник" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.ref2_emoji = {
    id: "ref2_emoji",
    title: "widget.ref2_emoji",
    category: "reference",
    description: "Searchable emoji picker; click to copy",
    defaultSize: { w: 8, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const E = [
            ["😀", "grinning face smile happy"], ["😁", "beaming grin"], ["😂", "joy laugh tears"], ["🤣", "rolling laughing rofl"],
            ["😊", "smiling blush happy"], ["😍", "heart eyes love"], ["😘", "kiss blow"], ["😎", "cool sunglasses"],
            ["🤔", "thinking hmm"], ["😴", "sleeping tired"], ["😭", "crying sob sad"], ["😡", "angry mad rage"],
            ["🥳", "party celebrate"], ["😱", "scream shock fear"], ["🤯", "mind blown exploding"], ["😇", "angel innocent"],
            ["👍", "thumbs up like yes"], ["👎", "thumbs down no dislike"], ["👏", "clap applause"], ["🙏", "pray thanks please"],
            ["🤝", "handshake deal"], ["💪", "muscle strong"], ["👀", "eyes look"], ["✌️", "peace victory"],
            ["👋", "wave hello bye"], ["🤙", "call shaka"], ["🫶", "heart hands love"], ["🖐️", "hand five stop"],
            ["❤️", "red heart love"], ["🧡", "orange heart"], ["💛", "yellow heart"], ["💚", "green heart"],
            ["💙", "blue heart"], ["💜", "purple heart"], ["🖤", "black heart"], ["💔", "broken heart"],
            ["🔥", "fire lit hot"], ["⭐", "star favorite"], ["✨", "sparkles shiny"], ["⚡", "lightning bolt zap"],
            ["💯", "hundred percent"], ["✅", "check tick done ok"], ["❌", "cross wrong no error"], ["⚠️", "warning caution"],
            ["🎉", "party tada celebrate"], ["🎊", "confetti"], ["🎁", "gift present"], ["🏆", "trophy win"],
            ["🚀", "rocket launch ship"], ["💡", "idea bulb light"], ["🔧", "wrench tool fix"], ["🐛", "bug insect"],
            ["💻", "laptop computer code"], ["📱", "phone mobile"], ["⌨️", "keyboard type"], ["🖱️", "mouse click"],
            ["📦", "package box deliver"], ["🔒", "lock secure closed"], ["🔓", "unlock open"], ["🔑", "key access"],
            ["🌍", "earth world globe"], ["☀️", "sun sunny"], ["🌙", "moon night"], ["☁️", "cloud"],
            ["🌈", "rainbow"], ["❄️", "snow cold snowflake"], ["💧", "water drop"], ["🌊", "wave ocean sea"],
            ["🍕", "pizza food"], ["🍔", "burger food"], ["🍺", "beer drink"], ["☕", "coffee cup"],
            ["🐶", "dog puppy"], ["🐱", "cat kitten"], ["🦄", "unicorn"], ["🐢", "turtle slow"],
            ["💰", "money bag cash"], ["📈", "chart up growth"], ["📉", "chart down loss"], ["🕐", "clock time"]
        ];
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px">
              <input id="_em_q" placeholder="search emoji: love, fire, ok…" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono);font-size:12px" />
              <div id="_em_grid" style="flex:1;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(38px,1fr));gap:3px;align-content:start"></div>
              <div id="_em_hint" style="color:var(--text-dim);font-size:10.5px;min-height:14px">Click an emoji to copy.</div>
            </div>`;
        const q = body.querySelector("#_em_q");
        const grid = body.querySelector("#_em_grid");
        const hint = body.querySelector("#_em_hint");

        const render = () => {
            const f = q.value.trim().toLowerCase();
            const list = E.filter(([, kw]) => !f || kw.includes(f));
            grid.innerHTML = list.map(([e, kw]) =>
                `<button data-e="${esc(e)}" title="${esc(kw)}" style="cursor:pointer;font-size:22px;line-height:1;padding:6px 0;background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;color:var(--text)">${esc(e)}</button>`
            ).join("") || `<div style="color:var(--text-dim);font-size:11px;grid-column:1/-1">no match</div>`;
        };
        const onClick = e => {
            const b = e.target.closest("button[data-e]");
            if (!b) return;
            const em = b.getAttribute("data-e");
            navigator.clipboard.writeText(em).then(() => {
                hint.textContent = "Copied " + em;
                setTimeout(() => { hint.textContent = "Click an emoji to copy."; }, 900);
            }).catch(() => {});
        };
        q.addEventListener("input", render);
        grid.addEventListener("click", onClick);
        render();
        return { destroy() { q.removeEventListener("input", render); grid.removeEventListener("click", onClick); } };
    }
};
