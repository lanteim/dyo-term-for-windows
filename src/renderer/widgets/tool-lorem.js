"use strict";
window.I18N.register({
    en: { "widget.tool_lorem": "Lorem Ipsum", "cat.tools": "Tools" },
    ru: { "widget.tool_lorem": "Lorem Ipsum", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.tool_lorem = {
    id: "tool_lorem",
    title: "widget.tool_lorem",
    category: "tools",
    description: "Generate N paragraphs of lorem ipsum",
    defaultSize: { w: 7, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono);font-size:12px";
        const btn = "background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 12px;font-family:var(--font-mono);font-size:12px;cursor:pointer;font-weight:600";
        const sbtn = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;font-family:var(--font-mono);font-size:12px;cursor:pointer";
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:8px;height:100%">
                <div style="display:flex;gap:6px;align-items:center">
                    <label style="font-size:12px;color:var(--text-dim)">Paragraphs</label>
                    <input class="lo-n" type="number" min="1" max="50" value="3" style="${inp};width:64px" />
                    <button class="lo-gen" style="${btn}">Generate</button>
                    <button class="lo-copy" style="${sbtn}">Copy</button>
                </div>
                <div class="lo-out" style="flex:1;overflow:auto;font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word"></div>
            </div>`;
        const nIn = body.querySelector(".lo-n");
        const gen = body.querySelector(".lo-gen");
        const copy = body.querySelector(".lo-copy");
        const out = body.querySelector(".lo-out");
        const WORDS = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum".split(" ");
        const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
        const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
        const sentence = () => {
            const len = rnd(6, 14);
            let w = [];
            for (let i = 0; i < len; i++) w.push(WORDS[rnd(0, WORDS.length - 1)]);
            return cap(w.join(" ")) + ".";
        };
        const para = () => {
            const n = rnd(3, 6);
            let s = [];
            for (let i = 0; i < n; i++) s.push(sentence());
            return s.join(" ");
        };
        let currentText = "";
        const run = () => {
            let n = parseInt(nIn.value, 10);
            if (isNaN(n) || n < 1) n = 1;
            if (n > 50) n = 50;
            const ps = [];
            for (let i = 0; i < n; i++) ps.push(para());
            currentText = ps.join("\n\n");
            out.textContent = currentText;
        };
        gen.onclick = run;
        copy.onclick = () => navigator.clipboard.writeText(currentText).catch(() => {});
        run();
        return { destroy() { gen.onclick = copy.onclick = null; } };
    }
};
