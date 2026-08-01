"use strict";
window.I18N.register({
    en: { "widget.api_dnsapi": "DNS Lookup", "cat.web": "Web" },
    ru: { "widget.api_dnsapi": "DNS запрос", "cat.web": "Веб" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.api_dnsapi = {
    id: "api_dnsapi",
    title: "widget.api_dnsapi",
    category: "web",
    description: "Resolve DNS records via Google DNS-over-HTTPS (dns.google/resolve)",
    defaultSize: { w: 7, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        let alive = true, busy = false;
        const TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "SRV", "CAA", "PTR"];
        const TMAP = { 1: "A", 2: "NS", 5: "CNAME", 6: "SOA", 12: "PTR", 15: "MX", 16: "TXT", 28: "AAAA", 33: "SRV", 257: "CAA" };

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <span style="color:var(--accent);font-weight:600">dns</span>
              <input id="_dn_name" placeholder="example.com" style="flex:1;min-width:130px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <select id="_dn_type" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px">${TYPES.map(t => `<option>${t}</option>`).join("")}</select>
              <button id="_dn_go" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 10px;cursor:pointer;font-family:var(--font-mono)">Resolve</button>
              <span id="_dn_st" style="color:var(--text-dim);margin-left:auto"></span>
            </div>
            <div id="_dn_msg" style="color:var(--text-dim);font-size:11px"></div>
            <div id="_dn_list" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;font-family:var(--font-mono);font-size:11.5px"></div>
          </div>`;
        const $ = s => body.querySelector(s);

        const go = async () => {
            if (busy) return; busy = true;
            const name = $("#_dn_name").value.trim();
            const type = $("#_dn_type").value;
            if (!name) { $("#_dn_msg").innerHTML = `<span style="color:var(--danger)">enter a domain</span>`; busy = false; return; }
            $("#_dn_st").textContent = "resolving…"; $("#_dn_msg").textContent = "";
            const url = "https://dns.google/resolve?name=" + encodeURIComponent(name) + "&type=" + encodeURIComponent(type);
            try {
                const r = await window.dyo.http(url, { method: "GET", timeout: 12000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) { $("#_dn_msg").innerHTML = `<span style="color:var(--danger)">request failed: ${esc(r && (r.error || r.status))}</span>`; $("#_dn_st").textContent = "failed"; $("#_dn_list").innerHTML = ""; return; }
                const d = JSON.parse(r.text);
                const STATUS = { 0: "NOERROR", 1: "FORMERR", 2: "SERVFAIL", 3: "NXDOMAIN", 5: "REFUSED" };
                const ans = d.Answer || [];
                $("#_dn_st").textContent = (STATUS[d.Status] || ("status " + d.Status)) + " · " + ans.length;
                if (!ans.length) { $("#_dn_list").innerHTML = `<div style="padding:10px;color:var(--text-dim)">No ${esc(type)} records${d.Status ? " (" + esc(STATUS[d.Status] || d.Status) + ")" : ""}.</div>`; busy = false; return; }
                $("#_dn_list").innerHTML = ans.slice(0, 200).map(a => {
                    const tn = TMAP[a.type] || a.type;
                    return `<div style="display:flex;gap:8px;padding:3px 8px;border-bottom:1px solid var(--border);white-space:nowrap"><span style="color:var(--accent2);width:52px">${esc(tn)}</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis">${esc(a.data)}</span><span style="color:var(--text-dim)">${esc("TTL " + a.TTL)}</span></div>`;
                }).join("");
            } catch (e) { if (alive) $("#_dn_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`; }
            finally { busy = false; }
        };
        $("#_dn_go").onclick = go;
        $("#_dn_name").addEventListener("keydown", e => { if (e.key === "Enter") go(); });
        $("#_dn_type").addEventListener("change", go);
        return { destroy: () => { alive = false; } };
    }
};
