"use strict";
window.I18N.register({
    en: { "widget.api_useragent": "User-Agent Parser", "cat.web": "Web" },
    ru: { "widget.api_useragent": "Разбор User-Agent", "cat.web": "Веб" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.api_useragent = {
    id: "api_useragent",
    title: "widget.api_useragent",
    category: "web",
    description: "Parse a User-Agent string into browser / OS / device heuristics",
    defaultSize: { w: 7, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        let alive = true;

        const parse = ua => {
            const out = { browser: "Unknown", os: "Unknown", device: "Desktop", engine: "Unknown", bot: false };
            if (/bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless/i.test(ua)) out.bot = true;
            // engine
            if (/Gecko\/\d/i.test(ua) && /Firefox/i.test(ua)) out.engine = "Gecko";
            else if (/AppleWebKit/i.test(ua)) out.engine = /Chrome|Chromium|Edg|OPR/i.test(ua) ? "Blink" : "WebKit";
            else if (/Trident/i.test(ua)) out.engine = "Trident";
            // browser (order matters)
            let m;
            if ((m = /Edg(?:e|A|iOS)?\/([\d.]+)/i.exec(ua))) out.browser = "Edge " + m[1];
            else if ((m = /OPR\/([\d.]+)/i.exec(ua)) || (m = /Opera\/([\d.]+)/i.exec(ua))) out.browser = "Opera " + m[1];
            else if ((m = /SamsungBrowser\/([\d.]+)/i.exec(ua))) out.browser = "Samsung Internet " + m[1];
            else if ((m = /Firefox\/([\d.]+)/i.exec(ua))) out.browser = "Firefox " + m[1];
            else if (/Chrome|CriOS|Chromium/i.test(ua) && (m = /(?:Chrome|CriOS|Chromium)\/([\d.]+)/i.exec(ua))) out.browser = "Chrome " + m[1];
            else if (/Safari/i.test(ua) && (m = /Version\/([\d.]+)/i.exec(ua))) out.browser = "Safari " + m[1];
            else if ((m = /MSIE ([\d.]+)/i.exec(ua)) || /Trident/i.test(ua)) out.browser = "Internet Explorer " + (m ? m[1] : "11");
            else if ((m = /curl\/([\d.]+)/i.exec(ua))) out.browser = "curl " + m[1];
            else if ((m = /wget\/([\d.]+)/i.exec(ua))) out.browser = "Wget " + m[1];
            // os
            if ((m = /Windows NT ([\d.]+)/i.exec(ua))) { const w = { "10.0": "10/11", "6.3": "8.1", "6.2": "8", "6.1": "7" }[m[1]] || m[1]; out.os = "Windows " + w; }
            else if ((m = /Android ([\d.]+)/i.exec(ua))) { out.os = "Android " + m[1]; out.device = "Mobile"; }
            else if (/iPhone/i.test(ua)) { out.os = "iOS" + ((m = /OS ([\d_]+)/i.exec(ua)) ? " " + m[1].replace(/_/g, ".") : ""); out.device = "Mobile"; }
            else if (/iPad/i.test(ua)) { out.os = "iPadOS" + ((m = /OS ([\d_]+)/i.exec(ua)) ? " " + m[1].replace(/_/g, ".") : ""); out.device = "Tablet"; }
            else if ((m = /Mac OS X ([\d_]+)/i.exec(ua))) out.os = "macOS " + m[1].replace(/_/g, ".");
            else if (/CrOS/i.test(ua)) out.os = "ChromeOS";
            else if (/Linux/i.test(ua)) out.os = "Linux";
            if (/Mobile|Android/i.test(ua) && out.device === "Desktop") out.device = "Mobile";
            if (/Tablet|iPad/i.test(ua)) out.device = "Tablet";
            if (out.bot) out.device = "Bot";
            return out;
        };

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div style="display:flex;gap:6px;align-items:center">
              <span style="color:var(--accent);font-weight:600">user-agent</span>
              <button id="_ua_this" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 10px;cursor:pointer;font-family:var(--font-mono)">This browser</button>
            </div>
            <textarea id="_ua_in" placeholder="paste a User-Agent string…" style="height:64px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono);font-size:11px;resize:none"></textarea>
            <div id="_ua_out" style="flex:1;overflow:auto"></div>
          </div>`;
        const $ = s => body.querySelector(s);

        const render = () => {
            const ua = $("#_ua_in").value.trim();
            if (!ua) { $("#_ua_out").innerHTML = `<div style="color:var(--text-dim);padding:6px">Paste a UA string or click “This browser”.</div>`; return; }
            const p = parse(ua);
            const row = (k, v, c) => `<div class="metric-row"><span class="k">${esc(k)}</span><span class="v" style="color:${c || "var(--text)"}">${esc(v)}</span></div>`;
            $("#_ua_out").innerHTML = row("BROWSER", p.browser, "var(--accent2)") + row("ENGINE", p.engine) + row("OS", p.os) + row("DEVICE", p.device, p.bot ? "var(--danger)" : "var(--accent)") + row("BOT", p.bot ? "yes" : "no", p.bot ? "var(--danger)" : "var(--text-dim)");
        };
        $("#_ua_in").addEventListener("input", render);
        $("#_ua_this").onclick = () => { $("#_ua_in").value = navigator.userAgent || ""; render(); };
        render();
        return { destroy: () => { alive = false; } };
    }
};
