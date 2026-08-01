"use strict";
window.I18N.register({
    en: { "widget.enc2_morse": "Text ↔ Morse", "cat.tools": "Tools" },
    ru: { "widget.enc2_morse": "Текст ↔ Морзе", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.enc2_morse = {
    id: "enc2_morse",
    title: "widget.enc2_morse",
    category: "tools",
    description: "Convert text to Morse code and back, live as you type",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        let alive = true;
        const inputCss = "font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 8px;width:100%;box-sizing:border-box;resize:none";
        const btnCss = "font-family:var(--font-mono);font-size:11px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer";
        const MAP = {
            A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....",
            I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.",
            Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
            Y: "-.--", Z: "--..", "0": "-----", "1": ".----", "2": "..---", "3": "...--",
            "4": "....-", "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
            ".": ".-.-.-", ",": "--..--", "?": "..--..", "'": ".----.", "!": "-.-.--",
            "/": "-..-.", "(": "-.--.", ")": "-.--.-", "&": ".-...", ":": "---...",
            ";": "-.-.-.", "=": "-...-", "+": ".-.-.", "-": "-....-", "_": "..--.-",
            '"': ".-..-.", "$": "...-..-", "@": ".--.-."
        };
        const REV = {};
        for (const k in MAP) REV[MAP[k]] = k;
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
            <div style="display:flex;gap:6px;align-items:center">
              <select class="_dir" style="${inputCss};width:auto;padding:4px 6px">
                <option value="enc">Text → Morse</option>
                <option value="dec">Morse → Text</option>
              </select>
              <button class="_copy" style="${btnCss};margin-left:auto">Copy result</button>
            </div>
            <textarea class="_in" spellcheck="false" placeholder="Type text or morse (use / for word gap)…" style="${inputCss};flex:1"></textarea>
            <textarea class="_out" readonly placeholder="Result…" style="${inputCss};flex:1;color:var(--accent)"></textarea>
            <div class="_err" style="color:var(--danger);font-size:11px;min-height:14px"></div>
          </div>`;
        const $ = s => body.querySelector(s);
        const run = () => {
            const v = $("._in").value, dir = $("._dir").value;
            let out = "", err = "";
            if (dir === "enc") {
                const words = v.toUpperCase().trim().split(/\s+/);
                const enc = [];
                const unknown = [];
                for (const w of words) {
                    const letters = [];
                    for (const ch of w) {
                        if (MAP[ch]) letters.push(MAP[ch]);
                        else if (ch) unknown.push(ch);
                    }
                    if (letters.length) enc.push(letters.join(" "));
                }
                out = enc.join(" / ");
                if (unknown.length) err = "Skipped unsupported: " + [...new Set(unknown)].join(" ");
            } else {
                const words = v.trim().split(/\s*\/\s*|\s{2,}/);
                const decWords = [];
                const bad = [];
                for (const w of words) {
                    if (!w.trim()) continue;
                    const chars = w.trim().split(/\s+/).map(code => {
                        if (REV[code] != null) return REV[code];
                        bad.push(code);
                        return "�";
                    });
                    decWords.push(chars.join(""));
                }
                out = decWords.join(" ");
                if (bad.length) err = "Unknown code: " + [...new Set(bad)].join(" ");
            }
            $("._out").value = out;
            $("._err").textContent = err;
        };
        $("._in").oninput = run;
        $("._dir").onchange = run;
        $("._copy").onclick = () => navigator.clipboard.writeText($("._out").value).catch(() => {});
        run();
        return { destroy: () => { alive = false; } };
    }
};
