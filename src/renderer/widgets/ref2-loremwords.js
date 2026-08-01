"use strict";
window.I18N.register({
    en: { "widget.ref2_loremwords": "Lorem Ipsum", "cat.reference": "Reference" },
    ru: { "widget.ref2_loremwords": "Lorem Ipsum", "cat.reference": "Справочник" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.ref2_loremwords = {
    id: "ref2_loremwords",
    title: "widget.ref2_loremwords",
    category: "reference",
    description: "Generate N lorem-ipsum words, sentences or paragraphs",
    defaultSize: { w: 8, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const W = ("lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum perspiciatis unde omnis iste natus error accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab illo inventore veritatis quasi architecto beatae vitae dicta sunt explicabo").split(" ");

        const rnd = () => {
            const a = new Uint32Array(1);
            crypto.getRandomValues(a);
            return a[0] / 4294967296;
        };
        const pick = () => W[Math.floor(rnd() * W.length)];
        const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

        const genSentence = () => {
            const len = 6 + Math.floor(rnd() * 10);
            const words = [];
            for (let i = 0; i < len; i++) words.push(pick());
            const s = cap(words.join(" "));
            return s + ".";
        };
        const genParagraph = () => {
            const n = 3 + Math.floor(rnd() * 4);
            const out = [];
            for (let i = 0; i < n; i++) out.push(genSentence());
            return out.join(" ");
        };

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px">
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <input id="_lo_n" type="number" min="1" max="500" value="5" style="width:70px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono)" />
                <select id="_lo_u" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono)">
                  <option value="w">words</option>
                  <option value="s">sentences</option>
                  <option value="p" selected>paragraphs</option>
                </select>
                <button id="_lo_gen" style="cursor:pointer;background:var(--bg-elevated);color:var(--accent);border:1px solid var(--border);border-radius:6px;padding:5px 12px;font-family:var(--font-mono)">Generate</button>
                <button id="_lo_copy" style="cursor:pointer;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 12px;font-family:var(--font-mono)">Copy</button>
                <span id="_lo_hint" style="color:var(--text-dim);font-size:10.5px"></span>
              </div>
              <div id="_lo_out" style="flex:1;overflow:auto;white-space:pre-wrap;font-size:12.5px;line-height:1.5;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px;background:var(--bg-elevated)"></div>
            </div>`;
        const nEl = body.querySelector("#_lo_n");
        const uEl = body.querySelector("#_lo_u");
        const genBtn = body.querySelector("#_lo_gen");
        const copyBtn = body.querySelector("#_lo_copy");
        const out = body.querySelector("#_lo_out");
        const hint = body.querySelector("#_lo_hint");

        const generate = () => {
            let n = parseInt(nEl.value, 10);
            if (!Number.isFinite(n) || n < 1) n = 1;
            if (n > 500) n = 500;
            const u = uEl.value;
            let text = "";
            if (u === "w") {
                const words = [];
                for (let i = 0; i < n; i++) words.push(pick());
                text = cap(words.join(" ")) + ".";
            } else if (u === "s") {
                const arr = [];
                for (let i = 0; i < n; i++) arr.push(genSentence());
                text = arr.join(" ");
            } else {
                const arr = [];
                for (let i = 0; i < n; i++) arr.push(genParagraph());
                text = arr.join("\n\n");
            }
            out.textContent = text;
        };
        const copy = () => {
            navigator.clipboard.writeText(out.textContent).then(() => {
                hint.textContent = "Copied!";
                setTimeout(() => { hint.textContent = ""; }, 900);
            }).catch(() => {});
        };
        genBtn.addEventListener("click", generate);
        copyBtn.addEventListener("click", copy);
        nEl.addEventListener("input", generate);
        uEl.addEventListener("change", generate);
        generate();
        return { destroy() { genBtn.removeEventListener("click", generate); copyBtn.removeEventListener("click", copy); nEl.removeEventListener("input", generate); uEl.removeEventListener("change", generate); } };
    }
};
