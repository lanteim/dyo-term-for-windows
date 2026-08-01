"use strict";
window.I18N.register({
    en: { "widget.enc2_hex": "Text ↔ Hex", "cat.tools": "Tools" },
    ru: { "widget.enc2_hex": "Текст ↔ Hex", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.enc2_hex = {
    id: "enc2_hex",
    title: "widget.enc2_hex",
    category: "tools",
    description: "Convert UTF-8 text to hex and back, live as you type",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        let alive = true;
        const inputCss = "font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 8px;width:100%;box-sizing:border-box;resize:none";
        const btnCss = "font-family:var(--font-mono);font-size:11px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer";
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
            <div style="display:flex;gap:6px;align-items:center">
              <select class="_dir" style="${inputCss};width:auto;padding:4px 6px">
                <option value="enc">Text → Hex</option>
                <option value="dec">Hex → Text</option>
              </select>
              <label style="color:var(--text-dim);display:flex;gap:4px;align-items:center"><input type="checkbox" class="_sp" checked>spaces</label>
              <button class="_copy" style="${btnCss};margin-left:auto">Copy result</button>
            </div>
            <textarea class="_in" spellcheck="false" placeholder="Type text or hex…" style="${inputCss};flex:1"></textarea>
            <textarea class="_out" readonly placeholder="Result…" style="${inputCss};flex:1;color:var(--accent)"></textarea>
            <div class="_err" style="color:var(--danger);font-size:11px;min-height:14px"></div>
          </div>`;
        const $ = s => body.querySelector(s);
        const enc = new TextEncoder();
        const dec = new TextDecoder("utf-8", { fatal: true });
        const run = () => {
            const v = $("._in").value, dir = $("._dir").value, sp = $("._sp").checked;
            let out = "", err = "";
            if (dir === "enc") {
                const bytes = enc.encode(v);
                const parts = [];
                for (const b of bytes) parts.push(b.toString(16).padStart(2, "0"));
                out = parts.join(sp ? " " : "");
            } else {
                const clean = v.replace(/0x/gi, "").replace(/[\s,]+/g, "");
                if (clean.length % 2 !== 0) { err = "Hex length must be even"; }
                else if (/[^0-9a-fA-F]/.test(clean)) { err = "Invalid hex characters"; }
                else {
                    const bytes = new Uint8Array(clean.length / 2);
                    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
                    try { out = dec.decode(bytes); } catch (e) { err = "Bytes are not valid UTF-8"; }
                }
            }
            $("._out").value = out;
            $("._err").textContent = err;
        };
        $("._in").oninput = run;
        $("._dir").onchange = run;
        $("._sp").onchange = run;
        $("._copy").onclick = () => navigator.clipboard.writeText($("._out").value).catch(() => {});
        run();
        return { destroy: () => { alive = false; } };
    }
};
