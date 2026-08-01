"use strict";
window.I18N.register({
    en: { "widget.enc_rsagen": "Key Pair Generator", "cat.security": "Security" },
    ru: { "widget.enc_rsagen": "Генератор ключей", "cat.security": "Безопасность" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.enc_rsagen = {
    id: "enc_rsagen",
    title: "widget.enc_rsagen",
    category: "security",
    description: "Generate RSA-OAEP or ECDSA key pair, export as PEM (WebCrypto)",
    defaultSize: { w: 7, h: 6 },
    mount(body) {
        let alive = true, busy = false;
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <select class="_alg" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:5px;padding:4px 6px">
                <option value="RSA-OAEP">RSA-OAEP (SHA-256)</option>
                <option value="ECDSA">ECDSA (P-256)</option>
              </select>
              <select class="_bits" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:5px;padding:4px 6px">
                <option value="2048">2048 bit</option>
                <option value="3072">3072 bit</option>
                <option value="4096">4096 bit</option>
              </select>
              <button class="_gen" style="background:transparent;color:var(--text);border:1px solid var(--accent);border-radius:6px;padding:5px 12px;cursor:pointer;font-family:var(--font-mono)">Generate</button>
              <span class="_msg" style="color:var(--text-dim)"></span>
            </div>
            <div style="display:flex;gap:8px;flex:1;min-height:0">
              <div style="flex:1;display:flex;flex-direction:column;gap:3px;min-width:0">
                <div style="display:flex;justify-content:space-between"><span style="color:var(--text-dim)">Public (SPKI)</span><button class="_cpub" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:4px;padding:1px 8px;cursor:pointer;font-size:11px">copy</button></div>
                <textarea class="_pub" readonly spellcheck="false" style="flex:1;font-family:var(--font-mono);font-size:10.5px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;resize:none;word-break:break-all"></textarea>
              </div>
              <div style="flex:1;display:flex;flex-direction:column;gap:3px;min-width:0">
                <div style="display:flex;justify-content:space-between"><span style="color:var(--text-dim)">Private (PKCS#8)</span><button class="_cpriv" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:4px;padding:1px 8px;cursor:pointer;font-size:11px">copy</button></div>
                <textarea class="_priv" readonly spellcheck="false" style="flex:1;font-family:var(--font-mono);font-size:10.5px;background:var(--bg-elevated);color:var(--danger);border:1px solid var(--border);border-radius:6px;padding:6px;resize:none;word-break:break-all"></textarea>
              </div>
            </div>
            <div style="color:var(--text-dim);font-size:11px">Private key stays in this window only. Store it securely; never paste it anywhere untrusted.</div>
          </div>`;
        const $ = s => body.querySelector(s);
        const msg = $("._msg");
        const ab2b64 = buf => {
            const b = new Uint8Array(buf);
            let bin = "";
            for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
            return btoa(bin);
        };
        const pem = (b64, label) => {
            const lines = b64.match(/.{1,64}/g) || [""];
            return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
        };
        const syncBits = () => { $("._bits").style.display = $("._alg").value === "RSA-OAEP" ? "" : "none"; };

        const gen = async () => {
            if (busy) return;
            busy = true;
            msg.style.color = "var(--text-dim)"; msg.textContent = "Generating…";
            $("._pub").value = ""; $("._priv").value = "";
            try {
                const alg = $("._alg").value;
                let params, usages;
                if (alg === "RSA-OAEP") {
                    params = { name: "RSA-OAEP", modulusLength: +$("._bits").value, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" };
                    usages = ["encrypt", "decrypt"];
                } else {
                    params = { name: "ECDSA", namedCurve: "P-256" };
                    usages = ["sign", "verify"];
                }
                const kp = await crypto.subtle.generateKey(params, true, usages);
                const spki = await crypto.subtle.exportKey("spki", kp.publicKey);
                const pkcs8 = await crypto.subtle.exportKey("pkcs8", kp.privateKey);
                if (!alive) return;
                $("._pub").value = pem(ab2b64(spki), "PUBLIC KEY");
                $("._priv").value = pem(ab2b64(pkcs8), "PRIVATE KEY");
                msg.style.color = "var(--accent)"; msg.textContent = alg + " key pair ready ✓";
            } catch (e) {
                if (!alive) return;
                msg.style.color = "var(--danger)"; msg.textContent = "Failed: " + (e && e.message ? e.message : e);
            } finally { busy = false; }
        };
        const cp = (sel) => { const v = $(sel).value; if (v) navigator.clipboard.writeText(v).catch(() => {}); };
        $("._alg").onchange = syncBits;
        $("._gen").onclick = gen;
        $("._cpub").onclick = () => cp("._pub");
        $("._cpriv").onclick = () => cp("._priv");
        syncBits();
        msg.textContent = "Choose algorithm and click Generate.";
        return { destroy: () => { alive = false; } };
    }
};
