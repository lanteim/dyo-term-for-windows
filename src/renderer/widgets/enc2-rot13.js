"use strict";
window.I18N.register({
    en: { "widget.enc2_rot13": "ROT13 / ROT-N", "cat.tools": "Tools" },
    ru: { "widget.enc2_rot13": "ROT13 / ROT-N", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.enc2_rot13 = {
    id: "enc2_rot13",
    title: "widget.enc2_rot13",
    category: "tools",
    description: "Caesar cipher: ROT13 or any shift N, live as you type",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        let alive = true;
        const inputCss = "font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 8px;width:100%;box-sizing:border-box;resize:none";
        const btnCss = "font-family:var(--font-mono);font-size:11px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer";
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
            <div style="display:flex;gap:8px;align-items:center">
              <span style="color:var(--text-dim)">Shift N</span>
              <input type="number" class="_n" value="13" min="0" max="25" style="${inputCss};width:60px;padding:4px 6px">
              <span class="_hint" style="color:var(--text-dim);font-size:11px">ROT13 is self-inverse</span>
              <button class="_copy" style="${btnCss};margin-left:auto">Copy result</button>
            </div>
            <textarea class="_in" spellcheck="false" placeholder="Type text…" style="${inputCss};flex:1"></textarea>
            <textarea class="_out" readonly placeholder="Result…" style="${inputCss};flex:1;color:var(--accent)"></textarea>
          </div>`;
        const $ = s => body.querySelector(s);
        const run = () => {
            const v = $("._in").value;
            let n = parseInt($("._n").value, 10);
            if (!isFinite(n)) n = 0;
            n = ((n % 26) + 26) % 26;
            const out = v.replace(/[a-zA-Z]/g, c => {
                const base = c <= "Z" ? 65 : 97;
                return String.fromCharCode((c.charCodeAt(0) - base + n) % 26 + base);
            });
            $("._out").value = out;
        };
        $("._in").oninput = run;
        $("._n").oninput = run;
        $("._copy").onclick = () => navigator.clipboard.writeText($("._out").value).catch(() => {});
        run();
        return { destroy: () => { alive = false; } };
    }
};
