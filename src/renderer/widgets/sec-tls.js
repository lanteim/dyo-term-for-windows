"use strict";
window.I18N.register({
    en: { "widget.sec_tls": "TLS Certificate", "cat.security": "Security" },
    ru: { "widget.sec_tls": "TLS-сертификат", "cat.security": "Безопасность" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.sec_tls = {
    id: "sec_tls",
    title: "widget.sec_tls",
    category: "security",
    description: "Check a host's TLS cert expiry via openssl s_client",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
              <div style="display:flex;gap:6px;align-items:center">
                <input class="_tl_in" placeholder="example.com or host:port" value="example.com" style="flex:1;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 8px;font-family:var(--font-mono)"/>
                <button class="_tl_go" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;cursor:pointer">Check</button>
              </div>
              <div class="_tl_out" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:6px">
                <div style="color:var(--text-dim)">Enter a host and press Check.</div>
              </div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;

        // Extract first PEM certificate from s_client output.
        const extractPem = (txt) => {
            const m = txt.match(/-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/);
            if (!m) return null;
            return m[1].replace(/[^A-Za-z0-9+/=]/g, "");
        };

        // Parse notBefore/notAfter from a DER cert by scanning ASN.1 time tags.
        const parseValidity = (b64) => {
            let der;
            try {
                const bin = atob(b64);
                der = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i);
            } catch (e) { return null; }
            const times = [];
            for (let i = 0; i < der.length - 2 && times.length < 2; i++) {
                const tag = der[i];
                if (tag !== 0x17 && tag !== 0x18) continue; // UTCTime / GeneralizedTime
                const len = der[i + 1];
                if (len < 10 || len > 20 || i + 2 + len > der.length) continue;
                let str = "";
                for (let j = 0; j < len; j++) str += String.fromCharCode(der[i + 2 + j]);
                const d = tag === 0x17 ? parseUTC(str) : parseGen(str);
                if (d && !isNaN(d.getTime())) { times.push(d); i += 1 + len; }
            }
            if (times.length < 2) return null;
            return { notBefore: times[0], notAfter: times[1] };
        };
        const parseUTC = (s) => {
            const m = s.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z?$/);
            if (!m) return null;
            let yy = parseInt(m[1], 10);
            const yr = yy < 50 ? 2000 + yy : 1900 + yy;
            return new Date(Date.UTC(yr, +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)));
        };
        const parseGen = (s) => {
            const m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z?$/);
            if (!m) return null;
            return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)));
        };

        const render = (host, port, val, raw) => {
            const out = $("._tl_out");
            if (!val) {
                const hint = `echo | openssl s_client -connect ${host}:${port} -servername ${host} 2>/dev/null | openssl x509 -noout -enddate`;
                out.innerHTML = `
                    <div style="color:var(--danger)">Could not read certificate from output.</div>
                    <div style="color:var(--text-dim)">Run manually in the terminal:</div>
                    <pre style="margin:0;font-family:var(--font-mono);font-size:11px;color:var(--text);white-space:pre-wrap;word-break:break-all;background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;padding:6px">${esc(hint)}</pre>
                    <button class="_tl_run" style="align-self:flex-start;background:transparent;color:var(--accent);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer">Run in terminal</button>
                    ${raw ? `<div style="color:var(--text-dim);font-size:10.5px">handshake bytes: ${raw.length}</div>` : ""}`;
                const btn = out.querySelector("._tl_run");
                if (btn) btn.onclick = () => { if (window.term && window.term.runInFocused) window.term.runInFocused(hint + "\n"); };
                return;
            }
            const now = Date.now();
            const days = Math.floor((val.notAfter.getTime() - now) / 86400000);
            const expired = days < 0;
            const warn = days < 14;
            const col = expired ? "var(--danger)" : (warn ? "var(--danger)" : "var(--accent)");
            const fmt = (d) => d.toISOString().replace("T", " ").replace(/:\d{2}\.\d{3}Z$/, " UTC");
            out.innerHTML = `
                <div class="metric-row"><span class="k">HOST</span><span class="v">${esc(host)}:${esc(String(port))}</span></div>
                <div class="metric-row"><span class="k">EXPIRES IN</span><span class="v"><b style="color:${col};font-size:15px">${expired ? "EXPIRED" : days + " day" + (days === 1 ? "" : "s")}</b></span></div>
                <div class="metric-row"><span class="k">NOT AFTER</span><span class="v" style="font-family:var(--font-mono);font-size:11px">${esc(fmt(val.notAfter))}</span></div>
                <div class="metric-row"><span class="k">NOT BEFORE</span><span class="v" style="font-family:var(--font-mono);font-size:11px;color:var(--text-dim)">${esc(fmt(val.notBefore))}</span></div>
                ${warn && !expired ? `<div style="color:var(--danger);font-size:11px">⚠ Certificate expires soon — renew it.</div>` : ""}`;
        };

        const run = async () => {
            if (busy) return;
            const rawin = $("._tl_in").value.trim();
            if (!rawin) return;
            let host = rawin, port = 443;
            const idx = rawin.lastIndexOf(":");
            if (idx > 0 && /^\d+$/.test(rawin.slice(idx + 1))) { host = rawin.slice(0, idx); port = parseInt(rawin.slice(idx + 1), 10); }
            busy = true;
            $("._tl_go").disabled = true;
            $("._tl_out").innerHTML = `<div style="color:var(--text-dim)">Connecting to ${esc(host)}:${esc(String(port))}…</div>`;
            try {
                const r = await window.dyo.exec("openssl", ["s_client", "-connect", host + ":" + port, "-servername", host], { timeout: 8000 });
                if (!alive) return;
                const txt = (r && (r.stdout || "")) + "\n" + (r && (r.stderr || ""));
                if (!txt.trim()) {
                    $("._tl_out").innerHTML = `<div style="color:var(--danger)">openssl produced no output (missing or connection failed).</div>`;
                    return;
                }
                const pem = extractPem(r && r.stdout || "");
                const val = pem ? parseValidity(pem) : null;
                render(host, port, val, r && r.stdout);
            } catch (e) {
                if (alive) $("._tl_out").innerHTML = `<div style="color:var(--danger)">Error: ${esc(e && e.message)}</div>`;
            } finally {
                if (alive) $("._tl_go").disabled = false;
                busy = false;
            }
        };
        $("._tl_go").onclick = run;
        $("._tl_in").addEventListener("keydown", e => { if (e.key === "Enter") run(); });

        return { destroy: () => { alive = false; } };
    }
};
