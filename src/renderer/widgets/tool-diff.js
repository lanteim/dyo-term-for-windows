"use strict";
window.I18N.register({
    en: { "widget.tool_diff": "Text Diff", "cat.tools": "Tools" },
    ru: { "widget.tool_diff": "Сравнение Текста", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.tool_diff = {
    id: "tool_diff",
    title: "widget.tool_diff",
    category: "tools",
    description: "Line diff between two texts",
    defaultSize: { w: 9, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono);font-size:11.5px";
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:6px;height:100%">
                <div style="display:flex;gap:6px;flex:0 0 auto">
                    <textarea class="df-a" placeholder="original" style="${inp};flex:1;resize:none;height:70px" spellcheck="false"></textarea>
                    <textarea class="df-b" placeholder="changed" style="${inp};flex:1;resize:none;height:70px" spellcheck="false"></textarea>
                </div>
                <div class="df-stat" style="font-size:11px;color:var(--text-dim)"></div>
                <div class="df-out" style="flex:1;overflow:auto;font-family:var(--font-mono);font-size:11.5px;white-space:pre-wrap;word-break:break-word"></div>
            </div>`;
        const a = body.querySelector(".df-a");
        const b = body.querySelector(".df-b");
        const stat = body.querySelector(".df-stat");
        const out = body.querySelector(".df-out");
        a.value = "line one\nline two\nline three";
        b.value = "line one\nline 2\nline three\nline four";

        // LCS-based line diff
        const diff = (A, B) => {
            const n = A.length, m = B.length;
            const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
            for (let i = n - 1; i >= 0; i--)
                for (let j = m - 1; j >= 0; j--)
                    dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
            const res = [];
            let i = 0, j = 0;
            while (i < n && j < m) {
                if (A[i] === B[j]) { res.push([" ", A[i]]); i++; j++; }
                else if (dp[i + 1][j] >= dp[i][j + 1]) { res.push(["-", A[i]]); i++; }
                else { res.push(["+", B[j]]); j++; }
            }
            while (i < n) res.push(["-", A[i++]]);
            while (j < m) res.push(["+", B[j++]]);
            return res;
        };
        const run = () => {
            const rows = diff(a.value.split("\n"), b.value.split("\n"));
            let add = 0, del = 0, html = "";
            for (const [sign, txt] of rows) {
                let color = "var(--text-dim)", bg = "transparent";
                if (sign === "+") { color = "var(--accent)"; bg = "rgba(60,200,120,0.12)"; add++; }
                else if (sign === "-") { color = "var(--danger)"; bg = "rgba(240,80,80,0.12)"; del++; }
                html += `<div style="color:${color};background:${bg};padding:0 4px">${esc(sign)} ${esc(txt) || "&nbsp;"}</div>`;
            }
            stat.innerHTML = `<span style="color:var(--accent)">+${add}</span>  <span style="color:var(--danger)">-${del}</span>`;
            out.innerHTML = html;
        };
        a.oninput = run;
        b.oninput = run;
        run();
        return { destroy() { a.oninput = b.oninput = null; } };
    }
};
