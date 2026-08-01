"use strict";
window.I18N.register({
    en: { "widget.sec_gpg": "GPG Keys", "cat.security": "Security" },
    ru: { "widget.sec_gpg": "GPG-ключи", "cat.security": "Безопасность" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.sec_gpg = {
    id: "sec_gpg",
    title: "widget.sec_gpg",
    category: "security",
    description: "Local GPG public keys via gpg --list-keys",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="color:var(--text-dim)">GPG keyring</span>
                <span class="_gp_meta" style="color:var(--text-dim);margin-left:auto">…</span>
                <button class="_gp_go" title="Refresh" aria-label="Refresh" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:3px 9px;cursor:pointer;font-size:11px">↻</button>
              </div>
              <div class="_gp_body" style="flex:1;overflow:auto"><div style="color:var(--text-dim)">Loading…</div></div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const now = Date.now();

        // Parse machine-readable colon output (--with-colons) for reliability.
        const parse = (out) => {
            const keys = [];
            let cur = null;
            out.split("\n").forEach(line => {
                const f = line.split(":");
                const rec = f[0];
                if (rec === "pub") {
                    if (cur) keys.push(cur);
                    cur = { keyid: f[4] || "", created: +f[5] || 0, expires: +f[6] || 0, algo: f[3] || "", bits: f[2] || "", uids: [] };
                } else if (rec === "uid" && cur) {
                    const uid = (f[9] || "").replace(/\\x3a/g, ":");
                    if (uid) cur.uids.push(uid);
                } else if (rec === "sub" && cur) {
                    /* ignore subkeys for compactness */
                }
            });
            if (cur) keys.push(cur);
            return keys;
        };
        const ALGO = { "1": "RSA", "16": "ElGamal", "17": "DSA", "18": "ECDH", "19": "ECDSA", "22": "EdDSA" };

        const render = (keys) => {
            $("._gp_meta").textContent = `${keys.length} key${keys.length === 1 ? "" : "s"}`;
            if (!keys.length) { $("._gp_body").innerHTML = `<div style="color:var(--text-dim)">No GPG keys in the keyring.</div>`; return; }
            let html = `<div style="display:flex;flex-direction:column;gap:5px">`;
            keys.forEach(k => {
                const expired = k.expires && k.expires * 1000 < now;
                const expSoon = k.expires && !expired && (k.expires * 1000 - now) < 14 * 86400000;
                const shortId = k.keyid ? k.keyid.slice(-8) : "?";
                const expTxt = k.expires ? new Date(k.expires * 1000).toISOString().slice(0, 10) : "never";
                const expCol = expired ? "var(--danger)" : (expSoon ? "var(--accent2)" : "var(--text-dim)");
                html += `<div style="border:1px solid var(--border);border-radius:6px;padding:6px 8px">
                    <div style="display:flex;align-items:center;gap:8px">
                      <b style="color:var(--accent);font-family:var(--font-mono)">${esc(shortId)}</b>
                      <span style="color:var(--text-dim);font-size:11px">${esc((ALGO[k.algo] || k.algo || "?") + (k.bits ? " " + k.bits : ""))}</span>
                      <span style="margin-left:auto;font-size:10.5px;color:${expCol}">${expired ? "EXPIRED " : "exp "}${esc(expTxt)}</span>
                    </div>
                    ${k.uids.slice(0, 3).map(u => `<div style="color:var(--text);font-family:var(--font-mono);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(u)}</div>`).join("")}
                  </div>`;
            });
            html += `</div>`;
            $("._gp_body").innerHTML = html;
        };

        const load = async () => {
            if (!alive || busy) return;
            busy = true;
            $("._gp_go").disabled = true;
            try {
                const r = await window.dyo.exec("gpg", ["--list-keys", "--with-colons", "--keyid-format", "long"], { timeout: 8000 });
                if (!alive) return;
                if (!r || (r.code !== 0 && !(r.stdout || "").trim())) {
                    $("._gp_meta").textContent = "";
                    const err = r && r.stderr ? r.stderr.trim().split("\n")[0] : "";
                    $("._gp_body").innerHTML = `<div style="color:var(--danger)">gpg not available or failed.</div>${err ? `<div style="color:var(--text-dim);font-size:11px;margin-top:4px">${esc(err)}</div>` : ""}`;
                    return;
                }
                render(parse(r.stdout || ""));
            } catch (e) {
                if (alive) $("._gp_body").innerHTML = `<div style="color:var(--danger)">Error: ${esc(e && e.message)}</div>`;
            } finally {
                if (alive) $("._gp_go").disabled = false;
                busy = false;
            }
        };
        $("._gp_go").onclick = load;
        load();
        return { destroy: () => { alive = false; } };
    }
};
