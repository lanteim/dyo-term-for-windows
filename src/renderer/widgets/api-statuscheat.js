"use strict";
window.I18N.register({
    en: { "widget.api_statuscheat": "HTTP Status Codes", "cat.web": "Web" },
    ru: { "widget.api_statuscheat": "HTTP статус-коды", "cat.web": "Веб" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.api_statuscheat = {
    id: "api_statuscheat",
    title: "widget.api_statuscheat",
    category: "web",
    description: "Offline quick-reference for HTTP status codes with search",
    defaultSize: { w: 6, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        let alive = true;
        const CODES = [
            [100, "Continue"], [101, "Switching Protocols"], [102, "Processing"], [103, "Early Hints"],
            [200, "OK"], [201, "Created"], [202, "Accepted"], [203, "Non-Authoritative Information"], [204, "No Content"], [205, "Reset Content"], [206, "Partial Content"], [207, "Multi-Status"], [208, "Already Reported"], [226, "IM Used"],
            [300, "Multiple Choices"], [301, "Moved Permanently"], [302, "Found"], [303, "See Other"], [304, "Not Modified"], [307, "Temporary Redirect"], [308, "Permanent Redirect"],
            [400, "Bad Request"], [401, "Unauthorized"], [402, "Payment Required"], [403, "Forbidden"], [404, "Not Found"], [405, "Method Not Allowed"], [406, "Not Acceptable"], [407, "Proxy Authentication Required"], [408, "Request Timeout"], [409, "Conflict"], [410, "Gone"], [411, "Length Required"], [412, "Precondition Failed"], [413, "Payload Too Large"], [414, "URI Too Long"], [415, "Unsupported Media Type"], [416, "Range Not Satisfiable"], [417, "Expectation Failed"], [418, "I'm a Teapot"], [421, "Misdirected Request"], [422, "Unprocessable Entity"], [423, "Locked"], [424, "Failed Dependency"], [425, "Too Early"], [426, "Upgrade Required"], [428, "Precondition Required"], [429, "Too Many Requests"], [431, "Request Header Fields Too Large"], [451, "Unavailable For Legal Reasons"],
            [500, "Internal Server Error"], [501, "Not Implemented"], [502, "Bad Gateway"], [503, "Service Unavailable"], [504, "Gateway Timeout"], [505, "HTTP Version Not Supported"], [506, "Variant Also Negotiates"], [507, "Insufficient Storage"], [508, "Loop Detected"], [510, "Not Extended"], [511, "Network Authentication Required"]
        ];
        const clsColor = c => c < 200 ? "var(--text-dim)" : c < 300 ? "var(--accent)" : c < 400 ? "var(--accent2)" : c < 500 ? "#e0a458" : "var(--danger)";

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div style="display:flex;gap:6px;align-items:center">
              <span style="color:var(--accent);font-weight:600">http status</span>
              <input id="_sc_f" placeholder="404, 5xx, timeout…" style="flex:1;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <span id="_sc_cnt" style="color:var(--text-dim)"></span>
            </div>
            <div id="_sc_list" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;font-family:var(--font-mono);font-size:11.5px"></div>
          </div>`;
        const $ = s => body.querySelector(s);

        const render = () => {
            const f = $("#_sc_f").value.trim().toLowerCase();
            const rows = CODES.filter(([c, t]) => {
                if (!f) return true;
                if (/^\dxx$/.test(f)) return String(c)[0] === f[0];
                return String(c).includes(f) || t.toLowerCase().includes(f);
            });
            $("#_sc_cnt").textContent = rows.length + "/" + CODES.length;
            $("#_sc_list").innerHTML = rows.map(([c, t]) => `<div style="display:flex;gap:8px;padding:3px 8px;border-bottom:1px solid var(--border);cursor:pointer" data-c="${c}"><b style="color:${clsColor(c)};width:40px">${c}</b><span>${esc(t)}</span></div>`).join("") || `<div style="padding:10px;color:var(--text-dim)">no match</div>`;
        };
        $("#_sc_f").addEventListener("input", render);
        $("#_sc_list").addEventListener("click", e => {
            const row = e.target.closest("[data-c]"); if (!row) return;
            const c = row.getAttribute("data-c");
            if (navigator.clipboard) navigator.clipboard.writeText(c);
            $("#_sc_cnt").textContent = "copied " + c;
        });
        render();
        return { destroy: () => { alive = false; } };
    }
};
