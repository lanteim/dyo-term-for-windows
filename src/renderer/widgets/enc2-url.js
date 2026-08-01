"use strict";
window.I18N.register({
    en: { "widget.enc2_url": "URL Encode/Decode", "cat.tools": "Tools" },
    ru: { "widget.enc2_url": "URL кодирование", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.enc2_url = {
    id: "enc2_url",
    title: "widget.enc2_url",
    category: "tools",
    description: "Encode/decode URI component, live as you type",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        let alive = true;
        const inputCss = "font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 8px;width:100%;box-sizing:border-box;resize:none";
        const btnCss = "font-family:var(--font-mono);font-size:11px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer";
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
            <div style="display:flex;gap:6px;align-items:center">
              <span style="color:var(--text-dim)">Direction</span>
              <select class="_dir" style="${inputCss};width:auto;padding:4px 6px">
                <option value="enc">Encode</option>
                <option value="dec">Decode</option>
              </select>
              <button class="_copy" style="${btnCss};margin-left:auto">Copy result</button>
            </div>
            <textarea class="_in" spellcheck="false" placeholder="Type text…" style="${inputCss};flex:1"></textarea>
            <textarea class="_out" readonly placeholder="Result…" style="${inputCss};flex:1;color:var(--accent)"></textarea>
            <div class="_err" style="color:var(--danger);font-size:11px;min-height:14px"></div>
          </div>`;
        const $ = s => body.querySelector(s);
        const run = () => {
            const v = $("._in").value, dir = $("._dir").value;
            let out = "", err = "";
            try {
                out = dir === "enc" ? encodeURIComponent(v) : decodeURIComponent(v);
            } catch (e) { err = "Malformed input: " + e.message; }
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
