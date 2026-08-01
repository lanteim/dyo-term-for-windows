"use strict";
window.I18N.register({
    en: { "widget.dnslookup": "DNS Lookup", "cat.network": "Network" },
    ru: { "widget.dnslookup": "DNS-запрос", "cat.network": "Сеть" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.dnslookup = {
    id: "dnslookup",
    title: "widget.dnslookup",
    category: "network",
    description: "Resolve A/AAAA records for a domain",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
              <div style="display:flex;gap:6px">
                <input class="_dns_in" placeholder="example.com" value="google.com" style="flex:1;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 8px;font-family:var(--font-mono)"/>
                <select class="_dns_type" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px">
                    <option>A</option><option>AAAA</option><option>MX</option><option>TXT</option><option>NS</option><option>CNAME</option>
                </select>
                <button class="_dns_go" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;cursor:pointer">Lookup</button>
              </div>
              <div class="_dns_out" style="flex:1;overflow:auto;font-family:var(--font-mono);font-size:12px;color:var(--text-dim)">Enter a domain and press Lookup.</div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;

        const run = async () => {
            if (busy) return;
            const domain = $("._dns_in").value.trim();
            const type = $("._dns_type").value;
            if (!domain) return;
            busy = true;
            $("._dns_out").innerHTML = `<span style="color:var(--text-dim)">resolving ${esc(domain)} (${esc(type)})…</span>`;
            try {
                let r = await window.dyo.exec("dig", ["+short", domain, type], { timeout: 8000 });
                let lines;
                if (!r || r.code !== 0) {
                    // fallback to nslookup
                    const ns = await window.dyo.exec("nslookup", ["-type=" + type, domain], { timeout: 8000 });
                    if (!ns || (ns.code !== 0 && !(ns.stdout || "").trim())) {
                        if (!alive) return;
                        $("._dns_out").innerHTML = `<span style="color:var(--danger)">dig and nslookup unavailable or failed.</span>`;
                        busy = false; return;
                    }
                    lines = (ns.stdout || "").split("\n").map(l => l.trim()).filter(l => l && !/^Server:|^Address:\s*\S+#\d+|^;;|^Non-authoritative/.test(l));
                } else {
                    lines = (r.stdout || "").split("\n").map(l => l.trim()).filter(Boolean);
                }
                if (!alive) return;
                if (!lines.length) {
                    $("._dns_out").innerHTML = `<span style="color:var(--text-dim)">No ${esc(type)} records found for ${esc(domain)}.</span>`;
                } else {
                    $("._dns_out").innerHTML = lines.slice(0, 50).map(l =>
                        `<div style="padding:3px 0;border-bottom:1px solid var(--border);color:var(--accent2)">${esc(l)}</div>`
                    ).join("");
                }
            } catch (e) {
                if (alive) $("._dns_out").innerHTML = `<span style="color:var(--danger)">Error: ${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };
        $("._dns_go").onclick = run;
        $("._dns_in").addEventListener("keydown", e => { if (e.key === "Enter") run(); });

        return { destroy: () => { alive = false; } };
    }
};
