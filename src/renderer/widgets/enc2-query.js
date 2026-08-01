"use strict";
window.I18N.register({
    en: { "widget.enc2_query": "Query String", "cat.tools": "Tools" },
    ru: { "widget.enc2_query": "Query-строка", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

function enc2QueryEsc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}

window.WIDGETS.enc2_query = {
    id: "enc2_query",
    title: "widget.enc2_query",
    category: "tools",
    description: "Parse a query string into a table and rebuild it",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        let alive = true;
        const inputCss = "font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 8px;width:100%;box-sizing:border-box;resize:none";
        const btnCss = "font-family:var(--font-mono);font-size:11px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer";
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
            <div style="display:flex;gap:6px;align-items:center">
              <span style="color:var(--text-dim)">Query string / URL</span>
              <button class="_copy" style="${btnCss};margin-left:auto">Copy query</button>
            </div>
            <textarea class="_in" spellcheck="false" placeholder="a=1&amp;b=hello%20world" style="${inputCss};height:56px"></textarea>
            <div style="color:var(--text-dim);font-size:11px">Decoded params</div>
            <div class="_tbl" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px"></div>
            <div class="_err" style="color:var(--danger);font-size:11px;min-height:14px"></div>
          </div>`;
        const $ = s => body.querySelector(s);
        const run = () => {
            let v = $("._in").value.trim();
            const q = v.indexOf("?");
            if (q > -1) v = v.slice(q + 1);
            const hash = v.indexOf("#");
            if (hash > -1) v = v.slice(0, hash);
            let err = "";
            const rows = [];
            if (v) {
                for (const pair of v.split("&")) {
                    if (!pair) continue;
                    const eq = pair.indexOf("=");
                    const rawK = eq > -1 ? pair.slice(0, eq) : pair;
                    const rawV = eq > -1 ? pair.slice(eq + 1) : "";
                    let k = rawK, val = rawV;
                    try { k = decodeURIComponent(rawK.replace(/\+/g, " ")); } catch (e) { err = "Bad key encoding"; }
                    try { val = decodeURIComponent(rawV.replace(/\+/g, " ")); } catch (e) { err = "Bad value encoding"; }
                    rows.push([k, val]);
                }
            }
            const tbl = $("._tbl");
            if (!rows.length) {
                tbl.innerHTML = `<div style="color:var(--text-dim);font-size:11px;padding:8px">No parameters.</div>`;
            } else {
                let html = `<table style="width:100%;border-collapse:collapse;font-size:11.5px">`;
                for (const [k, val] of rows) {
                    html += `<tr>
                      <td style="padding:4px 8px;border-bottom:1px solid var(--border);color:var(--accent);white-space:nowrap;vertical-align:top">${enc2QueryEsc(k)}</td>
                      <td style="padding:4px 8px;border-bottom:1px solid var(--border);word-break:break-all">${enc2QueryEsc(val)}</td>
                    </tr>`;
                }
                html += `</table>`;
                tbl.innerHTML = html;
            }
            $("._err").textContent = err;
        };
        $("._in").oninput = run;
        $("._copy").onclick = () => {
            let v = $("._in").value.trim();
            const q = v.indexOf("?");
            navigator.clipboard.writeText(q > -1 ? v.slice(q + 1) : v).catch(() => {});
        };
        run();
        return { destroy: () => { alive = false; } };
    }
};
