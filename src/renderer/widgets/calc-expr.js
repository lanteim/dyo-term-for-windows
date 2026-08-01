"use strict";
window.I18N.register({
    en: { "widget.calc_expr": "Expression Eval", "cat.tools": "Tools" },
    ru: { "widget.calc_expr": "Вычислитель", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.calc_expr = {
    id: "calc_expr",
    title: "widget.calc_expr",
    category: "tools",
    description: "Safe arithmetic evaluator (+ - * / % ^ parens) — no eval",
    defaultSize: { w: 7, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px;font-family:var(--font-mono);font-size:16px;width:100%;box-sizing:border-box";

        // ---- tokenizer ----
        const tokenize = (s) => {
            const toks = [];
            let i = 0;
            while (i < s.length) {
                const c = s[i];
                if (c === " " || c === "\t") { i++; continue; }
                if (/[0-9.]/.test(c)) {
                    let j = i, seenDot = false, seenE = false;
                    while (j < s.length) {
                        const d = s[j];
                        if (d >= "0" && d <= "9") { j++; }
                        else if (d === "." && !seenDot && !seenE) { seenDot = true; j++; }
                        else if ((d === "e" || d === "E") && !seenE && j > i) {
                            seenE = true; j++;
                            if (s[j] === "+" || s[j] === "-") j++;
                        } else break;
                    }
                    const numStr = s.slice(i, j);
                    const num = Number(numStr);
                    if (!Number.isFinite(num)) throw new Error("bad number: " + numStr);
                    toks.push({ t: "num", v: num });
                    i = j;
                } else if ("+-*/%^".includes(c)) {
                    toks.push({ t: "op", v: c });
                    i++;
                } else if (c === "(") { toks.push({ t: "lp" }); i++; }
                else if (c === ")") { toks.push({ t: "rp" }); i++; }
                else throw new Error("unexpected '" + c + "'");
            }
            return toks;
        };

        // ---- shunting-yard to RPN, with unary minus/plus ----
        const prec = { "+": 2, "-": 2, "*": 3, "/": 3, "%": 3, "^": 4, "u-": 5, "u+": 5 };
        const rightAssoc = { "^": true, "u-": true, "u+": true };
        const toRPN = (toks) => {
            const out = [], ops = [];
            let prev = null; // previous token type for unary detection
            for (const tk of toks) {
                if (tk.t === "num") { out.push(tk); prev = "num"; }
                else if (tk.t === "op") {
                    let op = tk.v;
                    const isUnary = (op === "-" || op === "+") && (prev === null || prev === "op" || prev === "lp");
                    if (isUnary) op = "u" + op;
                    while (ops.length) {
                        const top = ops[ops.length - 1];
                        if (top.t !== "op") break;
                        const tp = prec[top.v], cp = prec[op];
                        if (tp > cp || (tp === cp && !rightAssoc[op])) out.push(ops.pop());
                        else break;
                    }
                    ops.push({ t: "op", v: op });
                    prev = "op";
                } else if (tk.t === "lp") { ops.push(tk); prev = "lp"; }
                else if (tk.t === "rp") {
                    let found = false;
                    while (ops.length) {
                        const top = ops.pop();
                        if (top.t === "lp") { found = true; break; }
                        out.push(top);
                    }
                    if (!found) throw new Error("mismatched )");
                    prev = "rp";
                }
            }
            while (ops.length) {
                const top = ops.pop();
                if (top.t === "lp") throw new Error("mismatched (");
                out.push(top);
            }
            return out;
        };

        const evalRPN = (rpn) => {
            const st = [];
            for (const tk of rpn) {
                if (tk.t === "num") st.push(tk.v);
                else {
                    const op = tk.v;
                    if (op === "u-") { if (!st.length) throw new Error("syntax"); st.push(-st.pop()); continue; }
                    if (op === "u+") { if (!st.length) throw new Error("syntax"); continue; }
                    if (st.length < 2) throw new Error("syntax");
                    const b = st.pop(), a = st.pop();
                    let r;
                    switch (op) {
                        case "+": r = a + b; break;
                        case "-": r = a - b; break;
                        case "*": r = a * b; break;
                        case "/": if (b === 0) throw new Error("division by zero"); r = a / b; break;
                        case "%": if (b === 0) throw new Error("modulo by zero"); r = a % b; break;
                        case "^": r = Math.pow(a, b); break;
                        default: throw new Error("op?");
                    }
                    st.push(r);
                }
            }
            if (st.length !== 1) throw new Error("syntax");
            return st[0];
        };

        const evaluate = (s) => evalRPN(toRPN(tokenize(s)));

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:10px;padding:2px">
                <input class="e-in" style="${inp}" placeholder="2 + 3 * (4 - 1) ^ 2" spellcheck="false">
                <div style="display:flex;align-items:baseline;gap:8px">
                    <span style="color:var(--text-dim)">=</span>
                    <b class="e-out" style="font-size:20px;font-family:var(--font-mono);cursor:pointer" title="copy">—</b>
                </div>
                <div class="e-err" style="color:var(--danger);font-size:12px;min-height:14px"></div>
                <div style="color:var(--text-dim);font-size:11px">operators: + − * / % ^ and parentheses · no eval, shunting-yard</div>
            </div>`;
        const el = body.querySelector(".e-in"), out = body.querySelector(".e-out"), err = body.querySelector(".e-err");
        el.value = "2 + 3 * (4 - 1) ^ 2";
        const fmt = n => {
            if (!Number.isFinite(n)) return n > 0 ? "∞" : (n < 0 ? "−∞" : "NaN");
            const r = Math.round(n * 1e10) / 1e10;
            return String(r);
        };
        const calc = () => {
            const s = el.value.trim();
            if (s === "") { out.textContent = "—"; err.textContent = ""; out.onclick = null; return; }
            try {
                const v = evaluate(s);
                const txt = fmt(v);
                out.textContent = txt;
                out.style.color = "var(--accent)";
                err.textContent = "";
                out.onclick = () => { if (txt !== "—") navigator.clipboard.writeText(txt); };
            } catch (e) {
                out.textContent = "—";
                out.style.color = "var(--text-dim)";
                out.onclick = null;
                err.textContent = esc(e && e.message ? e.message : "error");
            }
        };
        el.oninput = calc;
        calc();
        return { destroy() { el.oninput = null; out.onclick = null; } };
    }
};
