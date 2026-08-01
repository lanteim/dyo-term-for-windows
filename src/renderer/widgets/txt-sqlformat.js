"use strict";
window.I18N.register({
    en: { "widget.txt_sqlformat": "SQL Formatter", "cat.tools": "Tools" },
    ru: { "widget.txt_sqlformat": "Форматтер SQL", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.txt_sqlformat = {
    id: "txt_sqlformat",
    title: "widget.txt_sqlformat",
    category: "tools",
    description: "Naive SQL pretty-printer: keywords on new lines, indented (client-side)",
    defaultSize: { w: 8, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

        // Newline-before keywords, and indented continuation. Tokenizer preserves strings/comments.
        const NL_KW = ["SELECT", "FROM", "WHERE", "AND", "OR", "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "OFFSET",
            "INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "FULL JOIN", "CROSS JOIN", "JOIN", "ON",
            "UNION ALL", "UNION", "INSERT INTO", "VALUES", "UPDATE", "SET", "DELETE FROM", "RETURNING", "WITH"];
        const indented = new Set(["AND", "OR", "ON"]);

        const format = sql => {
            // tokenize keeping strings and comments intact
            const toks = [];
            let i = 0; const s = sql;
            while (i < s.length) {
                const c = s[i];
                if (c === "'" || c === '"' || c === "`") {
                    let j = i + 1, str = c;
                    while (j < s.length) { str += s[j]; if (s[j] === c && s[j + 1] === c) { str += s[j + 1]; j += 2; continue; } if (s[j] === c) { j++; break; } j++; }
                    toks.push({ t: "str", v: str }); i = j; continue;
                }
                if (c === "-" && s[i + 1] === "-") { let j = i; while (j < s.length && s[j] !== "\n") j++; toks.push({ t: "cmt", v: s.slice(i, j) }); i = j; continue; }
                if (c === "/" && s[i + 1] === "*") { let j = i + 2; while (j < s.length && !(s[j] === "*" && s[j + 1] === "/")) j++; j += 2; toks.push({ t: "cmt", v: s.slice(i, j) }); i = j; continue; }
                if (/\s/.test(c)) { i++; continue; }
                if (c === "(" || c === ")" || c === ",") { toks.push({ t: "punc", v: c }); i++; continue; }
                let j = i; while (j < s.length && !/[\s(),'"`]/.test(s[j]) && !(s[j] === "-" && s[j + 1] === "-")) j++;
                toks.push({ t: "word", v: s.slice(i, j) }); i = j;
            }

            // rebuild into words with multi-word keywords joined
            const upper = toks.map(t => t.t === "word" ? t.v.toUpperCase() : t.v);
            const out = []; let depth = 0; let line = ""; let started = false;
            const push = () => { if (line.trim()) out.push(line); line = ""; };
            const pad = () => "  ".repeat(depth);

            for (let k = 0; k < toks.length; k++) {
                // try match two-word keyword
                let kw = null, adv = 0;
                if (toks[k].t === "word") {
                    const two = (upper[k] + " " + (upper[k + 1] || "")).trim();
                    if (NL_KW.includes(two)) { kw = two; adv = 1; }
                    else if (NL_KW.includes(upper[k])) { kw = upper[k]; adv = 0; }
                }
                const tk = toks[k];
                if (kw) {
                    push();
                    const extra = indented.has(kw) ? "  " : "";
                    line = pad() + extra + kw;
                    started = true;
                    k += adv;
                    continue;
                }
                if (tk.t === "punc" && tk.v === ",") { line += ","; push(); line = pad() + (started ? "  " : ""); continue; }
                if (tk.t === "punc" && tk.v === "(") { line += (line.trim() ? "" : "") + "("; depth++; continue; }
                if (tk.t === "punc" && tk.v === ")") { depth = Math.max(0, depth - 1); line += ")"; continue; }
                if (tk.t === "cmt") { push(); out.push(pad() + tk.v); continue; }
                const val = tk.t === "word" ? tk.v : tk.v;
                if (line.trim() === "" || line.endsWith("(")) line += val;
                else line += " " + val;
            }
            push();
            return out.join("\n").replace(/\(\s+/g, "(").replace(/ +\n/g, "\n").trim();
        };

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:6px;height:100%">
            <div style="display:flex;gap:6px;align-items:center">
              <button id="_sql_go" style="cursor:pointer">Format →</button>
              <button id="_sql_copy" style="cursor:pointer">Copy</button>
              <span id="_sql_msg" style="color:var(--text-dim);font-size:11px"></span>
            </div>
            <textarea id="_sql_in" spellcheck="false" placeholder="select id,name from users u join orders o on o.uid=u.id where u.active=true and o.total>100 order by o.total" style="flex:1;min-height:60px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
            <textarea id="_sql_out" spellcheck="false" readonly style="flex:1;min-height:60px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
          </div>`;
        const $ = s => body.querySelector(s);
        const inp = $("#_sql_in"), out = $("#_sql_out"), msg = $("#_sql_msg");

        const run = () => {
            const src = inp.value;
            if (!src.trim()) { out.value = ""; msg.textContent = ""; return; }
            try { out.value = format(src); msg.innerHTML = `<span style="color:var(--accent2)">formatted (naive)</span>`; }
            catch (e) { out.value = src; msg.innerHTML = `<span style="color:var(--danger)">${esc(e.message)}</span>`; }
        };
        const copy = () => { if (out.value) { navigator.clipboard.writeText(out.value); msg.innerHTML = `<span style="color:var(--accent)">copied</span>`; } };

        inp.addEventListener("input", run);
        $("#_sql_go").addEventListener("click", run);
        $("#_sql_copy").addEventListener("click", copy);

        return { destroy() { inp.removeEventListener("input", run); } };
    }
};
