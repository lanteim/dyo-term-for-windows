"use strict";
window.I18N.register({
    en: { "widget.enc2_hmac": "HMAC-SHA256", "cat.tools": "Tools" },
    ru: { "widget.enc2_hmac": "HMAC-SHA256", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.enc2_hmac = {
    id: "enc2_hmac",
    title: "widget.enc2_hmac",
    category: "tools",
    description: "HMAC-SHA256 of a message with a key, hex output",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        let alive = true;
        let token = 0;
        const inputCss = "font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 8px;width:100%;box-sizing:border-box;resize:none";
        const btnCss = "font-family:var(--font-mono);font-size:11px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer";
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
            <div style="color:var(--text-dim);font-size:11px">Secret key</div>
            <input class="_key" spellcheck="false" autocomplete="off" placeholder="key" style="${inputCss}">
            <div style="color:var(--text-dim);font-size:11px">Message</div>
            <textarea class="_msg" spellcheck="false" placeholder="message…" style="${inputCss};flex:1"></textarea>
            <div style="display:flex;gap:6px;align-items:center">
              <span style="color:var(--text-dim);font-size:11px">HMAC-SHA256 (hex)</span>
              <button class="_copy" style="${btnCss};margin-left:auto">Copy</button>
            </div>
            <textarea class="_out" readonly style="${inputCss};height:48px;color:var(--accent);word-break:break-all"></textarea>
            <div class="_err" style="color:var(--danger);font-size:11px;min-height:14px"></div>
          </div>`;
        const $ = s => body.querySelector(s);
        const enc = new TextEncoder();
        const toHex = buf => {
            const b = new Uint8Array(buf);
            let s = "";
            for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
            return s;
        };
        const run = async () => {
            const my = ++token;
            const key = $("._key").value, msg = $("._msg").value;
            if (!key) { $("._out").value = ""; $("._err").textContent = "Enter a key."; return; }
            $("._err").textContent = "";
            try {
                const ck = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
                const sig = await crypto.subtle.sign("HMAC", ck, enc.encode(msg));
                if (!alive || my !== token) return;
                $("._out").value = toHex(sig);
            } catch (e) {
                if (!alive || my !== token) return;
                $("._err").textContent = "Error: " + e.message;
                $("._out").value = "";
            }
        };
        $("._key").oninput = run;
        $("._msg").oninput = run;
        $("._copy").onclick = () => navigator.clipboard.writeText($("._out").value).catch(() => {});
        run();
        return { destroy: () => { alive = false; } };
    }
};
