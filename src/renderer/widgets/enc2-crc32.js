"use strict";
window.I18N.register({
    en: { "widget.enc2_crc32": "CRC32 Checksum", "cat.tools": "Tools" },
    ru: { "widget.enc2_crc32": "CRC32 контрольная сумма", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.enc2_crc32 = {
    id: "enc2_crc32",
    title: "widget.enc2_crc32",
    category: "tools",
    description: "CRC32 (IEEE) checksum of UTF-8 text, live as you type",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        let alive = true;
        const inputCss = "font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 8px;width:100%;box-sizing:border-box;resize:none";
        const btnCss = "font-family:var(--font-mono);font-size:11px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer";
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <textarea class="_in" spellcheck="false" placeholder="Type text…" style="${inputCss};flex:1"></textarea>
            <div style="display:flex;flex-direction:column;gap:4px">
              <div style="display:flex;gap:8px;align-items:center">
                <span style="color:var(--text-dim);width:70px">Hex</span>
                <span class="_hex" style="color:var(--accent);font-family:var(--font-mono);flex:1">00000000</span>
                <button class="_ch" style="${btnCss}">Copy</button>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                <span style="color:var(--text-dim);width:70px">Unsigned</span>
                <span class="_u" style="font-variant-numeric:tabular-nums;flex:1">0</span>
                <button class="_cu" style="${btnCss}">Copy</button>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        const table = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            table[n] = c >>> 0;
        }
        const enc = new TextEncoder();
        const crc32 = str => {
            const bytes = enc.encode(str);
            let crc = 0xFFFFFFFF;
            for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xFF];
            return (crc ^ 0xFFFFFFFF) >>> 0;
        };
        const run = () => {
            const v = crc32($("._in").value);
            $("._hex").textContent = v.toString(16).padStart(8, "0");
            $("._u").textContent = v.toString(10);
        };
        $("._in").oninput = run;
        $("._ch").onclick = () => navigator.clipboard.writeText($("._hex").textContent).catch(() => {});
        $("._cu").onclick = () => navigator.clipboard.writeText($("._u").textContent).catch(() => {});
        run();
        return { destroy: () => { alive = false; } };
    }
};
