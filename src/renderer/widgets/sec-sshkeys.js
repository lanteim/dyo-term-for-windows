"use strict";
window.I18N.register({
    en: { "widget.sec_sshkeys": "SSH Keys", "cat.security": "Security" },
    ru: { "widget.sec_sshkeys": "SSH-ключи", "cat.security": "Безопасность" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.sec_sshkeys = {
    id: "sec_sshkeys",
    title: "widget.sec_sshkeys",
    category: "security",
    description: "Public keys in ~/.ssh with type and comment",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div style="display:flex;align-items:center;gap:8px">
                <span class="_sk_dir" style="color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">~/.ssh</span>
                <span class="_sk_meta" style="color:var(--text-dim);margin-left:auto">…</span>
              </div>
              <div class="_sk_body" style="flex:1;overflow:auto"><div style="color:var(--text-dim)">Loading…</div></div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;

        const typeLabel = (algo) => {
            const m = { "ssh-ed25519": "Ed25519", "ssh-rsa": "RSA", "ssh-dss": "DSA (weak)", "ecdsa-sha2-nistp256": "ECDSA-256", "ecdsa-sha2-nistp384": "ECDSA-384", "ecdsa-sha2-nistp521": "ECDSA-521", "sk-ssh-ed25519@openssh.com": "Ed25519-SK", "sk-ecdsa-sha2-nistp256@openssh.com": "ECDSA-SK" };
            return m[algo] || algo;
        };
        const isWeak = (algo) => algo === "ssh-dss" || algo === "ssh-rsa"; // rsa flagged mildly, dsa strongly

        const parsePub = (content) => {
            const line = (content || "").split("\n").find(l => l.trim());
            if (!line) return null;
            const parts = line.trim().split(/\s+/);
            const algo = parts[0] || "?";
            const comment = parts.slice(2).join(" ");
            return { algo, comment };
        };

        const load = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const info = await window.dyo.appInfo();
                const home = (info && info.home) || "";
                const dir = home + "/.ssh";
                $("._sk_dir").textContent = dir;
                const ls = await window.dyo.fs.list(dir).catch(() => null);
                if (!alive) return;
                if (!Array.isArray(ls)) { $("._sk_meta").textContent = ""; $("._sk_body").innerHTML = `<div style="color:var(--text-dim)">No ~/.ssh directory or it is unreadable.</div>`; return; }
                const pubs = ls.filter(e => !e.dir && /\.pub$/.test(e.name));
                const privNames = new Set(ls.filter(e => !e.dir && !/\.(pub|known_hosts.*|config)$/.test(e.name)).map(e => e.name));
                if (!pubs.length) { $("._sk_meta").textContent = "0 keys"; $("._sk_body").innerHTML = `<div style="color:var(--text-dim)">No .pub keys found in ~/.ssh.</div>`; return; }
                const rows = [];
                for (const e of pubs) {
                    const r = await window.dyo.fs.read(dir + "/" + e.name, 8000).catch(() => null);
                    if (!alive) return;
                    const p = r && typeof r.content === "string" ? parsePub(r.content) : null;
                    const base = e.name.replace(/\.pub$/, "");
                    rows.push({ file: e.name, algo: p ? p.algo : "?", comment: p ? p.comment : "", hasPriv: privNames.has(base) });
                }
                $("._sk_meta").textContent = `${rows.length} key${rows.length === 1 ? "" : "s"}`;
                let html = `<div style="display:flex;flex-direction:column;gap:5px">`;
                rows.forEach(k => {
                    const weak = isWeak(k.algo);
                    const col = k.algo === "ssh-dss" ? "var(--danger)" : (weak ? "var(--accent2)" : "var(--accent)");
                    html += `<div style="border:1px solid var(--border);border-radius:6px;padding:6px 8px">
                        <div style="display:flex;align-items:center;gap:8px">
                          <b style="color:${col}">${esc(typeLabel(k.algo))}</b>
                          <span style="color:var(--text-dim);font-family:var(--font-mono);font-size:11px">${esc(k.file)}</span>
                          <span style="margin-left:auto;font-size:10.5px;color:${k.hasPriv ? "var(--text-dim)" : "var(--accent2)"}">${k.hasPriv ? "priv present" : "pub only"}</span>
                        </div>
                        <div style="color:var(--text);font-family:var(--font-mono);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${k.comment ? esc(k.comment) : "<span style=\"color:var(--text-dim)\">(no comment)</span>"}</div>
                        ${k.algo === "ssh-dss" ? `<div style="color:var(--danger);font-size:10.5px">⚠ DSA is insecure — replace with Ed25519.</div>` : ""}
                      </div>`;
                });
                html += `</div>`;
                $("._sk_body").innerHTML = html;
            } catch (e) {
                if (alive) $("._sk_body").innerHTML = `<div style="color:var(--danger)">Error: ${esc(e && e.message)}</div>`;
            } finally { busy = false; }
        };
        load();
        const iv = setInterval(load, 15000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
