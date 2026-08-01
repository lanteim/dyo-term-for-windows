"use strict";
window.I18N.register({
    en: { "widget.extra_calc": "Calculator", "cat.tools": "Tools" },
    ru: { "widget.extra_calc": "Калькулятор", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.extra_calc = {
    id: "extra_calc",
    title: "widget.extra_calc",
    category: "tools",
    description: "Safe arithmetic calculator (shunting-yard, no eval)",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        // Tokenize + shunting-yard + RPN eval. Supports + - * / % ^ parens, unary minus, decimals.
        const OPS = {
            "+": { p: 2, a: "L", f: (x, y) => x + y },
            "-": { p: 2, a: "L", f: (x, y) => x - y },
            "*": { p: 3, a: "L", f: (x, y) => x * y },
            "/": { p: 3, a: "L", f: (x, y) => x / y },
            "%": { p: 3, a: "L", f: (x, y) => x % y },
            "^": { p: 4, a: "R", f: (x, y) => Math.pow(x, y) }
        };
        const tokenize = src => {
            const t = []; let i = 0;
            while (i < src.length) {
                const c = src[i];
                if (c === " " || c === "\t") { i++; continue; }
                if ((c >= "0" && c <= "9") || c === ".") {
                    let n = ""; while (i < src.length && ((src[i] >= "0" && src[i] <= "9") || src[i] === ".")) n += src[i++];
                    if ((n.match(/\./g) || []).length > 1) throw new Error("bad number '" + n + "'");
                    t.push({ t: "num", v: parseFloat(n) }); continue;
                }
                if (c === "(" || c === ")") { t.push({ t: c }); i++; continue; }
                if (OPS[c]) { t.push({ t: "op", v: c }); i++; continue; }
                throw new Error("unexpected '" + c + "'");
            }
            return t;
        };
        const toRPN = toks => {
            const out = [], st = [];
            let prev = null;
            for (const tk of toks) {
                if (tk.t === "num") out.push(tk);
                else if (tk.t === "op") {
                    // unary minus/plus: op at start or after another op or "("
                    if ((tk.v === "-" || tk.v === "+") && (!prev || prev.t === "op" || prev.t === "(")) {
                        out.push({ t: "num", v: 0 });
                    }
                    while (st.length) {
                        const top = st[st.length - 1];
                        if (top.t === "op" && (OPS[top.v].p > OPS[tk.v].p || (OPS[top.v].p === OPS[tk.v].p && OPS[tk.v].a === "L"))) out.push(st.pop());
                        else break;
                    }
                    st.push(tk);
                } else if (tk.t === "(") st.push(tk);
                else if (tk.t === ")") {
                    while (st.length && st[st.length - 1].t !== "(") out.push(st.pop());
                    if (!st.length) throw new Error("mismatched )");
                    st.pop();
                }
                prev = tk;
            }
            while (st.length) { const o = st.pop(); if (o.t === "(") throw new Error("mismatched ("); out.push(o); }
            return out;
        };
        const evalRPN = rpn => {
            const st = [];
            for (const tk of rpn) {
                if (tk.t === "num") st.push(tk.v);
                else { const b = st.pop(), a = st.pop(); if (a === undefined || b === undefined) throw new Error("malformed expression"); st.push(OPS[tk.v].f(a, b)); }
            }
            if (st.length !== 1) throw new Error("malformed expression");
            return st[0];
        };
        const compute = src => {
            if (!src.trim()) return "";
            const r = evalRPN(toRPN(tokenize(src)));
            if (!isFinite(r)) throw new Error("division by zero / overflow");
            return Number(r.toFixed(10)).toString();
        };

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px">
              <input class="_in" placeholder="e.g.  (2+3)^2 * 4 % 7" style="width:100%;box-sizing:border-box"/>
              <div class="_out" style="font-size:28px;font-weight:500;color:var(--accent2);font-variant-numeric:tabular-nums;text-align:right;padding:6px 8px;min-height:36px;overflow:auto">0</div>
              <div class="_hist" style="flex:1;overflow:auto;font-size:11.5px;color:var(--text-dim);font-variant-numeric:tabular-nums"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        $("._in").style.cssText += ";background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px;font-family:var(--font-mono);font-size:14px";
        const hist = [];
        const run = () => {
            try { const r = compute($("._in").value); $("._out").textContent = r === "" ? "0" : r; $("._out").style.color = "var(--accent2)"; }
            catch (e) { $("._out").textContent = e.message; $("._out").style.color = "var(--danger)"; }
        };
        $("._in").oninput = run;
        $("._in").onkeydown = e => {
            if (e.key === "Enter") {
                const src = $("._in").value.trim(); if (!src) return;
                try { const r = compute(src); hist.unshift(src + " = " + r); if (hist.length > 30) hist.pop(); $("._hist").innerHTML = hist.map(h => `<div style="padding:2px 0">${h.replace(/[&<>]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]))}</div>`).join(""); } catch (x) {}
            }
        };
        run();
        return { destroy: () => {} };
    }
};
