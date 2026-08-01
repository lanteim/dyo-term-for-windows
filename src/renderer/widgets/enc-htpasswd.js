"use strict";
window.I18N.register({
    en: { "widget.enc_htpasswd": "htpasswd Line", "cat.security": "Security" },
    ru: { "widget.enc_htpasswd": "Строка htpasswd", "cat.security": "Безопасность" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.enc_htpasswd = {
    id: "enc_htpasswd",
    title: "widget.enc_htpasswd",
    category: "security",
    description: "Build an Apache htpasswd {SHA} line (base64 SHA-1) from user + password",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        let alive = true;
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div style="display:flex;gap:6px">
              <input class="_user" placeholder="username" spellcheck="false" style="flex:1;font-family:var(--font-mono);background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px 10px">
              <input class="_pw" placeholder="password" spellcheck="false" style="flex:1;font-family:var(--font-mono);background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px 10px">
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              <div class="_out" style="flex:1;font-family:var(--font-mono);font-size:13px;background:var(--bg-elevated);color:var(--accent2);border:1px solid var(--border);border-radius:6px;padding:8px 10px;word-break:break-all;min-height:18px"></div>
              <button class="_copy" style="background:transparent;color:var(--text);border:1px solid var(--accent);border-radius:6px;padding:8px 12px;cursor:pointer;font-family:var(--font-mono)">Copy</button>
            </div>
            <div style="color:var(--text-dim);font-size:11px;margin-top:auto">
              Uses <span style="font-family:var(--font-mono)">{SHA}</span> = base64(SHA-1(password)). Works with Apache/nginx basic auth. Note: SHA-1 is unsalted and fast — prefer bcrypt (<span style="font-family:var(--font-mono)">htpasswd -B</span>) for real deployments; WebCrypto has no bcrypt so it is not offered here.
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        const out = $("._out");
        let lastLine = "";
        const render = async () => {
            const user = $("._user").value.trim();
            const pw = $("._pw").value;
            if (!user && !pw) { out.textContent = ""; lastLine = ""; return; }
            try {
                const dig = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(pw));
                if (!alive) return;
                const b = new Uint8Array(dig);
                let bin = "";
                for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
                const line = `${user || "user"}:{SHA}${btoa(bin)}`;
                lastLine = line;
                out.textContent = line;
            } catch (e) {
                out.textContent = "Error: " + (e && e.message ? e.message : e);
                lastLine = "";
            }
        };
        $("._user").oninput = render;
        $("._pw").oninput = render;
        $("._copy").onclick = () => { if (lastLine) navigator.clipboard.writeText(lastLine).then(() => { const b = $("._copy"); b.textContent = "✓"; setTimeout(() => { if (alive) b.textContent = "Copy"; }, 900); }).catch(() => {}); };
        return { destroy: () => { alive = false; } };
    }
};
