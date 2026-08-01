"use strict";
window.I18N.register({
    en: { "widget.ref2_httpmethods": "HTTP Methods", "cat.reference": "Reference" },
    ru: { "widget.ref2_httpmethods": "HTTP методы", "cat.reference": "Справочник" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.ref2_httpmethods = {
    id: "ref2_httpmethods",
    title: "widget.ref2_httpmethods",
    category: "reference",
    description: "HTTP methods with semantics: safe, idempotent, cacheable, body",
    defaultSize: { w: 10, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const yes = "<span style='color:var(--accent)'>✓</span>";
        const no = "<span style='color:var(--text-dim)'>—</span>";
        const M = [
            { m: "GET", safe: 1, idem: 1, cache: 1, body: 0, d: "Retrieve a representation of a resource." },
            { m: "HEAD", safe: 1, idem: 1, cache: 1, body: 0, d: "Like GET but headers only, no body." },
            { m: "POST", safe: 0, idem: 0, cache: 0, body: 1, d: "Submit data; create subordinate / process." },
            { m: "PUT", safe: 0, idem: 1, cache: 0, body: 1, d: "Replace target resource entirely." },
            { m: "PATCH", safe: 0, idem: 0, cache: 0, body: 1, d: "Apply partial modifications." },
            { m: "DELETE", safe: 0, idem: 1, cache: 0, body: 0, d: "Remove the target resource." },
            { m: "OPTIONS", safe: 1, idem: 1, cache: 0, body: 0, d: "Describe communication options (CORS preflight)." },
            { m: "TRACE", safe: 1, idem: 1, cache: 0, body: 0, d: "Loopback test along the request path." },
            { m: "CONNECT", safe: 0, idem: 0, cache: 0, body: 0, d: "Establish a tunnel (e.g. HTTPS via proxy)." }
        ];
        body.innerHTML = `
            <div style="overflow:auto;height:100%">
              <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">
                <thead><tr style="color:var(--text-dim);text-align:left">
                  <th style="padding:4px 8px;position:sticky;top:0;background:var(--bg-elevated)">Method</th>
                  <th style="padding:4px 8px;position:sticky;top:0;background:var(--bg-elevated)">Safe</th>
                  <th style="padding:4px 8px;position:sticky;top:0;background:var(--bg-elevated)">Idem</th>
                  <th style="padding:4px 8px;position:sticky;top:0;background:var(--bg-elevated)">Cache</th>
                  <th style="padding:4px 8px;position:sticky;top:0;background:var(--bg-elevated)">Body</th>
                  <th style="padding:4px 8px;position:sticky;top:0;background:var(--bg-elevated)">Semantics</th>
                </tr></thead>
                <tbody>${M.map(r =>
            `<tr style="border-top:1px solid var(--border)">
                     <td style="padding:4px 8px;color:var(--accent);font-weight:bold">${esc(r.m)}</td>
                     <td style="padding:4px 8px">${r.safe ? yes : no}</td>
                     <td style="padding:4px 8px">${r.idem ? yes : no}</td>
                     <td style="padding:4px 8px">${r.cache ? yes : no}</td>
                     <td style="padding:4px 8px">${r.body ? yes : no}</td>
                     <td style="padding:4px 8px;color:var(--text)">${esc(r.d)}</td>
                   </tr>`).join("")}</tbody>
              </table>
              <div style="color:var(--text-dim);font-size:10.5px;padding:6px 8px">
                Safe = no side effects · Idem = repeatable with same effect · Cache = cacheable by default.
              </div>
            </div>`;
        return { destroy() {} };
    }
};
