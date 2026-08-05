"use strict";
window.I18N.register({
    en: { "widget.ref_cidr": "CIDR Calculator", "cat.reference": "Reference" },
    ru: { "widget.ref_cidr": "Калькулятор CIDR", "cat.reference": "Справочник" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.ref_cidr = {
    id: "ref_cidr",
    title: "widget.ref_cidr",
    category: "reference",
    description: "Subnet/CIDR calculator: network, broadcast, mask, host range & count",
    defaultSize: { w: 8, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const toInt = ip => ip.split(".").reduce((a, o) => (a << 8 >>> 0) + (parseInt(o, 10) & 255), 0) >>> 0;
        const toIp = n => [24, 16, 8, 0].map(s => (n >>> s) & 255).join(".");
        const validIp = ip => /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(ip) && ip.split(".").every(o => +o >= 0 && +o <= 255);

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:8px;height:100%;font-family:var(--font-mono)">
              <input id="_ci_in" placeholder="e.g. 192.168.1.10/24" value="192.168.1.0/24" style="width:100%;box-sizing:border-box;background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:7px 9px;font-family:var(--font-mono);font-size:13px">
              <div id="_ci_out" style="overflow:auto;flex:1"></div>
            </div>`;
        const inp = body.querySelector("#_ci_in");
        const out = body.querySelector("#_ci_out");

        const row = (k, v, copy) => `<div class="metric-row" style="display:flex;justify-content:space-between;gap:10px;padding:3px 0;border-bottom:1px solid var(--border)">
            <span class="k" style="color:var(--text-dim);font-size:12px">${esc(k)}</span>
            <span class="v" style="color:var(--text);font-size:12px;font-variant-numeric:tabular-nums;${copy ? "cursor:pointer" : ""}" ${copy ? 'data-copy="' + esc(String(v)) + '" title="Click to copy"' : ""}>${esc(v)}</span></div>`;

        const render = () => {
            const raw = inp.value.trim();
            const m = raw.match(/^(.+?)\/(\d{1,2})$/);
            if (!m || !validIp(m[1]) || +m[2] < 0 || +m[2] > 32) {
                out.innerHTML = `<div style="color:var(--text-dim);font-size:12px;padding:4px">Enter a valid CIDR like <b>10.0.0.0/16</b>.</div>`;
                return;
            }
            const ipN = toInt(m[1]);
            const bits = +m[2];
            const mask = bits === 0 ? 0 : (0xFFFFFFFF << (32 - bits)) >>> 0;
            const net = (ipN & mask) >>> 0;
            const bcast = (net | (~mask >>> 0)) >>> 0;
            const total = Math.pow(2, 32 - bits);
            const usable = bits >= 31 ? (bits === 32 ? 1 : 2) : total - 2;
            const first = bits >= 31 ? net : (net + 1) >>> 0;
            const last = bits >= 31 ? bcast : (bcast - 1) >>> 0;
            const wildcard = (~mask >>> 0);
            const priv = (net >= toInt("10.0.0.0") && bcast <= toInt("10.255.255.255")) ||
                (net >= toInt("172.16.0.0") && bcast <= toInt("172.31.255.255")) ||
                (net >= toInt("192.168.0.0") && bcast <= toInt("192.168.255.255"));
            out.innerHTML =
                row("Network", toIp(net) + "/" + bits, true) +
                row("Netmask", toIp(mask), true) +
                row("Wildcard", toIp(wildcard), true) +
                row("Broadcast", toIp(bcast), true) +
                row("Host range", bits >= 31 ? toIp(first) + " – " + toIp(last) : toIp(first) + " – " + toIp(last), false) +
                row("Usable hosts", usable.toLocaleString(window.I18N.locale()), false) +
                row("Total addresses", total.toLocaleString(window.I18N.locale()), false) +
                row("Scope", priv ? "Private (RFC1918)" : "Public / other", false);
            out.querySelectorAll("[data-copy]").forEach(el => {
                el.onclick = () => navigator.clipboard.writeText(el.dataset.copy).catch(() => {});
            });
        };
        inp.addEventListener("input", render);
        render();
        return { destroy: () => inp.removeEventListener("input", render) };
    }
};
