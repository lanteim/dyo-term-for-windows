"use strict";
window.I18N.register({
    en: { "widget.enc_totp": "TOTP Authenticator", "cat.security": "Security" },
    ru: { "widget.enc_totp": "TOTP аутентификатор", "cat.security": "Безопасность" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.enc_totp = {
    id: "enc_totp",
    title: "widget.enc_totp",
    category: "security",
    description: "Compute current 6-digit TOTP from a base32 secret (HMAC-SHA1, 30s)",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        let alive = true, iv = 0;
        const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <input class="_sec" placeholder="Base32 secret (e.g. JBSWY3DPEHPK3PXP)" spellcheck="false" style="font-family:var(--font-mono);background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px 10px;text-transform:uppercase">
            <div style="display:flex;align-items:center;gap:14px">
              <svg viewBox="0 0 44 44" width="52" height="52" style="flex:none">
                <circle cx="22" cy="22" r="19" fill="none" stroke="var(--border)" stroke-width="4"></circle>
                <circle class="_ring" cx="22" cy="22" r="19" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" transform="rotate(-90 22 22)" stroke-dasharray="119.4" stroke-dashoffset="0"></circle>
                <text class="_cd" x="22" y="26" text-anchor="middle" font-size="13" fill="var(--text)" font-family="var(--font-mono)">30</text>
              </svg>
              <div style="flex:1;min-width:0">
                <div class="_code" style="font-family:var(--font-mono);font-size:30px;letter-spacing:4px;color:var(--accent);font-variant-numeric:tabular-nums;cursor:pointer" title="Click to copy">------</div>
                <div class="_next" style="color:var(--text-dim);font-family:var(--font-mono);margin-top:2px">next ------</div>
              </div>
            </div>
            <div class="_msg" style="color:var(--text-dim);margin-top:auto"></div>
          </div>`;
        const $ = s => body.querySelector(s);
        const secEl = $("._sec"), codeEl = $("._code"), nextEl = $("._next"), msg = $("._msg");
        const saved = (window.dyo && window.dyo.settings) ? "" : "";
        try { const st = window.dyo && window.dyo.settings; if (st) st.get().then(v => { if (alive && v && v.enc_totp_secret) { secEl.value = v.enc_totp_secret; run(); } }).catch(() => {}); } catch (e) {}

        const b32decode = str => {
            const clean = str.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
            let bits = 0, val = 0;
            const out = [];
            for (const c of clean) {
                const idx = B32.indexOf(c);
                if (idx < 0) return null;
                val = (val << 5) | idx; bits += 5;
                if (bits >= 8) { bits -= 8; out.push((val >>> bits) & 0xFF); }
            }
            return new Uint8Array(out);
        };
        const counterBytes = counter => {
            const b = new Uint8Array(8);
            // counter fits in 53-bit safe range; fill big-endian
            let hi = Math.floor(counter / 0x100000000);
            let lo = counter >>> 0;
            b[0] = (hi >>> 24) & 0xFF; b[1] = (hi >>> 16) & 0xFF; b[2] = (hi >>> 8) & 0xFF; b[3] = hi & 0xFF;
            b[4] = (lo >>> 24) & 0xFF; b[5] = (lo >>> 16) & 0xFF; b[6] = (lo >>> 8) & 0xFF; b[7] = lo & 0xFF;
            return b;
        };
        const hotp = async (keyBytes, counter) => {
            const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
            const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, counterBytes(counter)));
            const off = sig[19] & 0x0F;
            const bin = ((sig[off] & 0x7F) << 24) | ((sig[off + 1] & 0xFF) << 16) | ((sig[off + 2] & 0xFF) << 8) | (sig[off + 3] & 0xFF);
            return String(bin % 1000000).padStart(6, "0");
        };

        let lastSecret = "", lastKey = null;
        const run = async () => {
            if (!alive) return;
            const raw = secEl.value.trim();
            if (!raw) { codeEl.textContent = "------"; nextEl.textContent = "next ------"; msg.textContent = "Enter a base32 secret to start."; setRing(0); return; }
            if (raw !== lastSecret) {
                const kb = b32decode(raw);
                if (!kb || !kb.length) { codeEl.textContent = "------"; nextEl.textContent = "next ------"; msg.textContent = "Invalid base32 secret."; msg.style.color = "var(--danger)"; lastKey = null; return; }
                lastSecret = raw; lastKey = kb; msg.style.color = "var(--text-dim)"; msg.textContent = "";
                try { const st = window.dyo && window.dyo.settings; if (st) st.set({ enc_totp_secret: raw }); } catch (e) {}
            }
            if (!lastKey) return;
            const now = Math.floor(Date.now() / 1000);
            const step = Math.floor(now / 30);
            const rem = 30 - (now % 30);
            try {
                const cur = await hotp(lastKey, step);
                const nxt = await hotp(lastKey, step + 1);
                if (!alive) return;
                codeEl.textContent = cur.slice(0, 3) + " " + cur.slice(3);
                nextEl.textContent = "next " + nxt.slice(0, 3) + " " + nxt.slice(3);
                codeEl.dataset.raw = cur;
            } catch (e) {
                msg.textContent = "Compute failed: " + (e && e.message ? e.message : e); msg.style.color = "var(--danger)";
            }
            setRing(rem);
        };
        const setRing = rem => {
            const C = 2 * Math.PI * 19;
            $("._ring").setAttribute("stroke-dasharray", C.toFixed(1));
            $("._ring").setAttribute("stroke-dashoffset", (C * (1 - rem / 30)).toFixed(1));
            $("._ring").setAttribute("stroke", rem <= 5 ? "var(--danger)" : "var(--accent)");
            $("._cd").textContent = rem;
        };
        codeEl.onclick = () => { if (codeEl.dataset.raw) navigator.clipboard.writeText(codeEl.dataset.raw).catch(() => {}); };
        secEl.oninput = () => { lastSecret = ""; run(); };
        run();
        iv = setInterval(run, 1000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
