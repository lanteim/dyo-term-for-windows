"use strict";
window.I18N.register({
    en: { "widget.enc_jwtbuild": "JWT Builder", "cat.security": "Security" },
    ru: { "widget.enc_jwtbuild": "Конструктор JWT", "cat.security": "Безопасность" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.enc_jwtbuild = {
    id: "enc_jwtbuild",
    title: "widget.enc_jwtbuild",
    category: "security",
    description: "Build an unsigned JWT or HS256-sign it with a secret (HMAC-SHA256)",
    defaultSize: { w: 7, h: 6 },
    mount(body) {
        let alive = true;
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
            <div style="display:flex;gap:8px">
              <div style="flex:1;display:flex;flex-direction:column;gap:3px">
                <span style="color:var(--text-dim)">Header JSON</span>
                <textarea class="_hdr" spellcheck="false" style="flex:1;min-height:52px;font-family:var(--font-mono);font-size:11.5px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;resize:vertical">{
  "alg": "HS256",
  "typ": "JWT"
}</textarea>
              </div>
              <div style="flex:1;display:flex;flex-direction:column;gap:3px">
                <span style="color:var(--text-dim)">Payload JSON</span>
                <textarea class="_pl" spellcheck="false" style="flex:1;min-height:52px;font-family:var(--font-mono);font-size:11.5px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;resize:vertical">{
  "sub": "1234567890",
  "name": "Ada",
  "iat": 1700000000
}</textarea>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <label style="color:var(--text-dim);cursor:pointer"><input type="checkbox" class="_sign" checked> Sign HS256</label>
              <input class="_secret" placeholder="HMAC secret" spellcheck="false" style="flex:1;min-width:120px;font-family:var(--font-mono);background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 8px">
              <button class="_build" style="background:transparent;color:var(--text);border:1px solid var(--accent);border-radius:6px;padding:6px 12px;cursor:pointer;font-family:var(--font-mono)">Build</button>
              <button class="_copy" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;cursor:pointer;font-family:var(--font-mono)">Copy</button>
            </div>
            <textarea class="_out" readonly spellcheck="false" style="flex:1;min-height:60px;font-family:var(--font-mono);font-size:11.5px;background:var(--bg-elevated);color:var(--accent2);border:1px solid var(--border);border-radius:6px;padding:6px;resize:vertical;word-break:break-all"></textarea>
            <div class="_msg" style="color:var(--text-dim)"></div>
          </div>`;
        const $ = s => body.querySelector(s);
        const msg = $("._msg"), out = $("._out");
        const b64url = bytes => {
            let bin = "";
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
            return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        };
        const strToB64url = s => b64url(new TextEncoder().encode(s));

        const build = async () => {
            msg.style.color = "var(--text-dim)"; msg.textContent = "";
            let hdrObj, plObj;
            try { hdrObj = JSON.parse($("._hdr").value); } catch (e) { msg.style.color = "var(--danger)"; msg.textContent = "Header JSON invalid: " + e.message; return; }
            try { plObj = JSON.parse($("._pl").value); } catch (e) { msg.style.color = "var(--danger)"; msg.textContent = "Payload JSON invalid: " + e.message; return; }
            const sign = $("._sign").checked;
            if (sign) hdrObj.alg = hdrObj.alg && hdrObj.alg !== "none" ? "HS256" : "HS256";
            else hdrObj.alg = "none";
            const headB64 = strToB64url(JSON.stringify(hdrObj));
            const plB64 = strToB64url(JSON.stringify(plObj));
            const signingInput = headB64 + "." + plB64;
            if (!sign) {
                out.value = signingInput + ".";
                msg.style.color = "var(--danger)";
                msg.textContent = "⚠ alg:none — UNSIGNED token. Anyone can forge it. Do not accept none-alg tokens server-side.";
                return;
            }
            const secret = $("._secret").value;
            if (!secret) { msg.style.color = "var(--danger)"; msg.textContent = "Enter an HMAC secret to sign."; return; }
            try {
                const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
                const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput)));
                if (!alive) return;
                out.value = signingInput + "." + b64url(sig);
                msg.style.color = "var(--accent)";
                msg.textContent = "Signed HS256 ✓ (symmetric — keep secret private)";
            } catch (e) {
                msg.style.color = "var(--danger)"; msg.textContent = "Sign failed: " + (e && e.message ? e.message : e);
            }
        };
        const toggleSecret = () => { $("._secret").style.opacity = $("._sign").checked ? "1" : "0.4"; };
        $("._build").onclick = build;
        $("._sign").onchange = () => { toggleSecret(); build(); };
        $("._copy").onclick = () => { if (out.value) navigator.clipboard.writeText(out.value).then(() => { const b = $("._copy"); b.textContent = "✓"; setTimeout(() => { if (alive) b.textContent = "Copy"; }, 900); }).catch(() => {}); };
        toggleSecret();
        build();
        return { destroy: () => { alive = false; } };
    }
};
