"use strict";
window.I18N.register({
    en: { "widget.api_mime": "MIME Lookup", "cat.web": "Web" },
    ru: { "widget.api_mime": "MIME справочник", "cat.web": "Веб" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.api_mime = {
    id: "api_mime",
    title: "widget.api_mime",
    category: "web",
    description: "Offline extension <-> MIME type lookup, search either direction",
    defaultSize: { w: 6, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        let alive = true;
        const T = {
            html: "text/html", htm: "text/html", css: "text/css", js: "text/javascript", mjs: "text/javascript", json: "application/json", xml: "application/xml", csv: "text/csv", txt: "text/plain", md: "text/markdown",
            png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", ico: "image/x-icon", bmp: "image/bmp", tiff: "image/tiff", avif: "image/avif", heic: "image/heic",
            mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", flac: "audio/flac", aac: "audio/aac", m4a: "audio/mp4",
            mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", avi: "video/x-msvideo", mkv: "video/x-matroska",
            pdf: "application/pdf", zip: "application/zip", gz: "application/gzip", tar: "application/x-tar", rar: "application/vnd.rar", "7z": "application/x-7z-compressed",
            doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf", eot: "application/vnd.ms-fontobject",
            wasm: "application/wasm", yaml: "application/yaml", yml: "application/yaml", toml: "application/toml", sh: "application/x-sh", bin: "application/octet-stream", ndjson: "application/x-ndjson", form: "application/x-www-form-urlencoded"
        };
        const LIST = Object.keys(T).sort().map(k => [k, T[k]]);

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div style="display:flex;gap:6px;align-items:center">
              <span style="color:var(--accent);font-weight:600">mime</span>
              <input id="_mi_f" placeholder="png  or  image/  or  json" style="flex:1;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <span id="_mi_cnt" style="color:var(--text-dim)"></span>
            </div>
            <div id="_mi_list" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;font-family:var(--font-mono);font-size:11.5px"></div>
          </div>`;
        const $ = s => body.querySelector(s);

        const render = () => {
            let f = $("#_mi_f").value.trim().toLowerCase().replace(/^\./, "");
            const rows = LIST.filter(([e, m]) => !f || e.includes(f) || m.includes(f));
            $("#_mi_cnt").textContent = rows.length + "/" + LIST.length;
            $("#_mi_list").innerHTML = rows.map(([e, m]) => `<div style="display:flex;gap:8px;padding:3px 8px;border-bottom:1px solid var(--border);cursor:pointer" data-m="${esc(m)}"><span style="color:var(--accent2);width:64px">.${esc(e)}</span><span>${esc(m)}</span></div>`).join("") || `<div style="padding:10px;color:var(--text-dim)">no match</div>`;
        };
        $("#_mi_f").addEventListener("input", render);
        $("#_mi_list").addEventListener("click", e => {
            const row = e.target.closest("[data-m]"); if (!row) return;
            const m = row.getAttribute("data-m");
            if (navigator.clipboard) navigator.clipboard.writeText(m);
            $("#_mi_cnt").textContent = "copied";
        });
        render();
        return { destroy: () => { alive = false; } };
    }
};
