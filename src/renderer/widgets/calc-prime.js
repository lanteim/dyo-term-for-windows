"use strict";
window.I18N.register({
    en: { "widget.calc_prime": "Prime & Factorize", "cat.tools": "Tools" },
    ru: { "widget.calc_prime": "Простые числа", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.calc_prime = {
    id: "calc_prime",
    title: "widget.calc_prime",
    category: "tools",
    description: "Is-prime test, factorization, and next prime",
    defaultSize: { w: 7, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono);width:180px;font-size:14px";
        const isPrime = n => {
            if (n < 2) return false;
            if (n < 4) return true;
            if (n % 2 === 0) return false;
            for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
            return true;
        };
        const factorize = n => {
            const f = [];
            while (n % 2 === 0) { f.push(2); n /= 2; }
            for (let i = 3; i * i <= n; i += 2) while (n % i === 0) { f.push(i); n /= i; }
            if (n > 1) f.push(n);
            return f;
        };
        const nextPrime = n => { let c = Math.max(2, Math.floor(n) + 1); while (!isPrime(c)) c++; return c; };
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:12px;font-size:13px;padding:2px">
                <div>
                    <span style="color:var(--text-dim)">Integer (≤ 2^53)</span><br>
                    <input class="pr-in" type="number" style="${inp};margin-top:4px" value="360" placeholder="e.g. 360">
                </div>
                <div class="pr-status" style="font-size:15px"></div>
                <div><span style="color:var(--text-dim)">Prime factors:</span> <span class="pr-fac" style="cursor:pointer;color:var(--accent)" title="copy"></span></div>
                <div><span style="color:var(--text-dim)">Next prime:</span> <b class="pr-next" style="cursor:pointer" title="copy"></b></div>
            </div>`;
        const q = c => body.querySelector(c);
        const el = q(".pr-in"), status = q(".pr-status"), fac = q(".pr-fac"), next = q(".pr-next");
        const setCopy = (node, txt) => { node.onclick = () => { if (txt) navigator.clipboard.writeText(txt); }; };
        const calc = () => {
            const raw = el.value.trim();
            const n = Number(raw);
            if (raw === "" || !Number.isFinite(n) || !Number.isInteger(n) || n > Number.MAX_SAFE_INTEGER) {
                status.innerHTML = `<span style="color:var(--text-dim)">enter an integer</span>`;
                fac.textContent = ""; next.textContent = ""; return;
            }
            if (n < 2) {
                status.innerHTML = `<b style="color:var(--text-dim)">${esc(String(n))}</b> is neither prime nor composite`;
            } else if (isPrime(n)) {
                status.innerHTML = `<b style="color:var(--accent)">${esc(String(n))} is prime</b>`;
            } else {
                status.innerHTML = `<b style="color:var(--danger)">${esc(String(n))} is composite</b>`;
            }
            if (n >= 2) {
                const f = factorize(n);
                const counts = {};
                f.forEach(x => counts[x] = (counts[x] || 0) + 1);
                const parts = Object.keys(counts).map(k => counts[k] > 1 ? `${k}^${counts[k]}` : k);
                const flat = f.join(" × ");
                fac.textContent = parts.join(" · ") + "  (" + flat + ")";
                setCopy(fac, flat);
            } else { fac.textContent = "—"; setCopy(fac, ""); }
            const np = nextPrime(n);
            next.textContent = String(np);
            setCopy(next, String(np));
        };
        el.oninput = calc;
        calc();
        return { destroy() { el.oninput = null; fac.onclick = null; next.onclick = null; } };
    }
};
