"use strict";
window.I18N.register({
    en: { "widget.enc_random": "Random Generator", "cat.security": "Security" },
    ru: { "widget.enc_random": "Генератор случайных", "cat.security": "Безопасность" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.enc_random = {
    id: "enc_random",
    title: "widget.enc_random",
    category: "security",
    description: "Cryptographically-random bytes as hex, base64 or UUID (getRandomValues)",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        let alive = true;
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <select class="_fmt" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:5px;padding:4px 6px">
                <option value="hex">hex</option>
                <option value="base64">base64</option>
                <option value="base64url">base64url</option>
                <option value="bytes">decimal bytes</option>
                <option value="uuid">UUID v4</option>
              </select>
              <span class="_nwrap" style="display:flex;align-items:center;gap:6px">
                <span style="color:var(--text-dim)">Bytes</span>
                <input class="_n" type="number" min="1" max="4096" value="32" style="width:70px;font-family:var(--font-mono);background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:5px;padding:4px 6px">
              </span>
              <button class="_gen" style="background:transparent;color:var(--text);border:1px solid var(--accent);border-radius:6px;padding:5px 12px;cursor:pointer;font-family:var(--font-mono)">Generate</button>
              <button class="_copy" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 12px;cursor:pointer;font-family:var(--font-mono)">Copy</button>
            </div>
            <textarea class="_out" readonly spellcheck="false" style="flex:1;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--accent2);border:1px solid var(--border);border-radius:6px;padding:8px;resize:none;word-break:break-all"></textarea>
            <div class="_msg" style="color:var(--text-dim);font-size:11px"></div>
          </div>`;
        const $ = s => body.querySelector(s);
        const out = $("._out"), msg = $("._msg");
        const toHex = b => Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");
        const toB64 = (b, url) => {
            let bin = "";
            for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
            let s = btoa(bin);
            if (url) s = s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
            return s;
        };
        const gen = () => {
            const fmt = $("._fmt").value;
            if (fmt === "uuid") {
                out.value = crypto.randomUUID ? crypto.randomUUID() : "";
                msg.textContent = "RFC 4122 v4 UUID";
                return;
            }
            let n = parseInt($("._n").value, 10);
            if (!(n >= 1)) n = 1;
            if (n > 4096) n = 4096;
            $("._n").value = n;
            const b = new Uint8Array(n);
            crypto.getRandomValues(b);
            if (fmt === "hex") out.value = toHex(b);
            else if (fmt === "base64") out.value = toB64(b, false);
            else if (fmt === "base64url") out.value = toB64(b, true);
            else out.value = Array.from(b).join(" ");
            msg.textContent = `${n} bytes · ${n * 8} bits of randomness`;
        };
        const syncN = () => { $("._nwrap").style.display = $("._fmt").value === "uuid" ? "none" : ""; gen(); };
        $("._fmt").onchange = syncN;
        $("._n").oninput = gen;
        $("._gen").onclick = gen;
        $("._copy").onclick = () => { if (out.value) navigator.clipboard.writeText(out.value).then(() => { const b = $("._copy"); b.textContent = "✓"; setTimeout(() => { if (alive) b.textContent = "Copy"; }, 900); }).catch(() => {}); };
        gen();
        return { destroy: () => { alive = false; } };
    }
};
