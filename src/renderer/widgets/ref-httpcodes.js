"use strict";
window.I18N.register({
    en: { "widget.ref_httpcodes": "HTTP Status Codes", "cat.reference": "Reference" },
    ru: { "widget.ref_httpcodes": "HTTP коды статусов", "cat.reference": "Справочник" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.ref_httpcodes = {
    id: "ref_httpcodes",
    title: "widget.ref_httpcodes",
    category: "reference",
    description: "Searchable HTTP status code list with meanings",
    defaultSize: { w: 8, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const CODES = [
            [100, "Continue", "Client should continue the request"],
            [101, "Switching Protocols", "Server is switching protocols per Upgrade header"],
            [102, "Processing", "Server received but not yet completed (WebDAV)"],
            [103, "Early Hints", "Preload resources while server prepares response"],
            [200, "OK", "Request succeeded"],
            [201, "Created", "Request succeeded and a new resource was created"],
            [202, "Accepted", "Accepted for processing, not yet completed"],
            [203, "Non-Authoritative Information", "Metadata from a copy, not the origin"],
            [204, "No Content", "Success, no body to return"],
            [205, "Reset Content", "Success, client should reset the document view"],
            [206, "Partial Content", "Range request succeeded"],
            [207, "Multi-Status", "Multiple independent statuses (WebDAV)"],
            [208, "Already Reported", "Members already enumerated (WebDAV)"],
            [226, "IM Used", "Result of instance manipulations applied"],
            [300, "Multiple Choices", "Multiple options for the resource"],
            [301, "Moved Permanently", "Resource permanently moved to a new URL"],
            [302, "Found", "Resource temporarily at a different URL"],
            [303, "See Other", "Get the resource from another URI with GET"],
            [304, "Not Modified", "Cached version is still valid"],
            [307, "Temporary Redirect", "Temporary redirect, keep the same method"],
            [308, "Permanent Redirect", "Permanent redirect, keep the same method"],
            [400, "Bad Request", "Malformed request syntax or invalid framing"],
            [401, "Unauthorized", "Authentication required or failed"],
            [402, "Payment Required", "Reserved for future/payment use"],
            [403, "Forbidden", "Authenticated but not allowed"],
            [404, "Not Found", "Resource does not exist"],
            [405, "Method Not Allowed", "HTTP method not supported for this resource"],
            [406, "Not Acceptable", "No content matching Accept headers"],
            [407, "Proxy Authentication Required", "Must authenticate with the proxy"],
            [408, "Request Timeout", "Server timed out waiting for the request"],
            [409, "Conflict", "Request conflicts with current server state"],
            [410, "Gone", "Resource permanently removed"],
            [411, "Length Required", "Content-Length header is required"],
            [412, "Precondition Failed", "A precondition header failed"],
            [413, "Payload Too Large", "Request body is too large"],
            [414, "URI Too Long", "The request URI is too long"],
            [415, "Unsupported Media Type", "Media type not supported"],
            [416, "Range Not Satisfiable", "Requested range cannot be served"],
            [417, "Expectation Failed", "Expect header cannot be met"],
            [418, "I'm a teapot", "April Fools' joke, refuses to brew coffee"],
            [421, "Misdirected Request", "Request sent to a server that cannot respond"],
            [422, "Unprocessable Entity", "Semantic errors in the request"],
            [423, "Locked", "Resource is locked (WebDAV)"],
            [424, "Failed Dependency", "Depends on a request that failed (WebDAV)"],
            [425, "Too Early", "Server unwilling to risk replayed request"],
            [426, "Upgrade Required", "Client must switch protocols"],
            [428, "Precondition Required", "Origin requires a conditional request"],
            [429, "Too Many Requests", "Rate limit exceeded"],
            [431, "Request Header Fields Too Large", "Headers are too large"],
            [451, "Unavailable For Legal Reasons", "Blocked for legal reasons"],
            [500, "Internal Server Error", "Generic server error"],
            [501, "Not Implemented", "Server does not support the functionality"],
            [502, "Bad Gateway", "Invalid response from upstream server"],
            [503, "Service Unavailable", "Server overloaded or down for maintenance"],
            [504, "Gateway Timeout", "Upstream server did not respond in time"],
            [505, "HTTP Version Not Supported", "HTTP version not supported"],
            [506, "Variant Also Negotiates", "Content negotiation config error"],
            [507, "Insufficient Storage", "Server cannot store the representation (WebDAV)"],
            [508, "Loop Detected", "Infinite loop while processing (WebDAV)"],
            [510, "Not Extended", "Further extensions required"],
            [511, "Network Authentication Required", "Must authenticate to gain network access"]
        ];
        const cls = c => c < 200 ? "var(--text-dim)" : c < 300 ? "var(--accent2)" : c < 400 ? "var(--accent)" : c < 500 ? "var(--danger)" : "var(--danger)";
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px">
              <input id="_hc_q" placeholder="Search code or text… e.g. 404, timeout, redirect" style="width:100%;box-sizing:border-box;background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 8px;font-family:var(--font-mono);font-size:12px">
              <div id="_hc_list" style="overflow:auto;flex:1"></div>
            </div>`;
        const q = body.querySelector("#_hc_q");
        const list = body.querySelector("#_hc_list");
        const render = () => {
            const s = q.value.trim().toLowerCase();
            const rows = CODES.filter(([c, n, d]) => !s || String(c).includes(s) || n.toLowerCase().includes(s) || d.toLowerCase().includes(s));
            if (!rows.length) { list.innerHTML = `<div style="color:var(--text-dim);font-size:12px;padding:8px">No matches.</div>`; return; }
            list.innerHTML = `<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11.5px">` +
                rows.map(([c, n, d]) => `<tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:4px 8px;font-weight:600;color:${cls(c)};vertical-align:top;font-variant-numeric:tabular-nums">${c}</td>
                    <td style="padding:4px 8px;color:var(--text);white-space:nowrap;vertical-align:top">${esc(n)}</td>
                    <td style="padding:4px 8px;color:var(--text-dim)">${esc(d)}</td></tr>`).join("") + `</table>`;
        };
        q.addEventListener("input", render);
        render();
        return { destroy: () => { q.removeEventListener("input", render); } };
    }
};
