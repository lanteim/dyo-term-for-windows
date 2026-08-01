"use strict";
window.I18N.register({
    en: { "widget.whois": "WHOIS", "cat.network": "Network" },
    ru: { "widget.whois": "WHOIS", "cat.network": "Сеть" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.whois = {
    id: "whois",
    title: "widget.whois",
    category: "network",
    description: "WHOIS registration info for a domain",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
              <div style="display:flex;gap:6px;align-items:center">
                <input class="_wh_in" placeholder="example.com" value="example.com" style="flex:1;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 8px;font-family:var(--font-mono)"/>
                <button class="_wh_go" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;cursor:pointer">WHOIS</button>
                <span class="_wh_meta" style="color:var(--text-dim)"></span>
              </div>
              <pre class="_wh_out" style="flex:1;overflow:auto;margin:0;font-family:var(--font-mono);font-size:11px;color:var(--text-dim);white-space:pre-wrap;word-break:break-all">Enter a domain and press WHOIS.</pre>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;

        const run = async () => {
            if (busy) return;
            const domain = $("._wh_in").value.trim();
            if (!domain) return;
            busy = true;
            $("._wh_go").disabled = true;
            $("._wh_meta").textContent = "querying…";
            $("._wh_out").textContent = `whois ${domain}…`;
            try {
                const r = await window.dyo.exec("whois", [domain], { timeout: 12000 });
                if (!alive) return;
                if (!r || (r.code !== 0 && !(r.stdout || "").trim())) {
                    const msg = (r && r.stderr && r.stderr.trim()) || "whois not available or failed";
                    $("._wh_out").innerHTML = `<span style="color:var(--danger)">${esc(msg)}</span>`;
                } else {
                    const lines = (r.stdout || "").split("\n").filter(l => {
                        const t = l.trim();
                        return t && !t.startsWith("%") && !t.startsWith("#") && !/^>>>|^NOTICE:|^TERMS OF USE|^by the following/i.test(t);
                    }).slice(0, 30);
                    $("._wh_meta").textContent = "";
                    if (!lines.length) $("._wh_out").innerHTML = `<span style="color:var(--text-dim)">No data returned.</span>`;
                    else $("._wh_out").textContent = lines.join("\n");
                }
            } catch (e) {
                if (alive) $("._wh_out").innerHTML = `<span style="color:var(--danger)">Error: ${esc(e && e.message)}</span>`;
            } finally {
                if (alive) { $("._wh_go").disabled = false; if ($("._wh_meta")) $("._wh_meta").textContent = ""; }
                busy = false;
            }
        };
        $("._wh_go").onclick = run;
        $("._wh_in").addEventListener("keydown", e => { if (e.key === "Enter") run(); });

        return { destroy: () => { alive = false; } };
    }
};
