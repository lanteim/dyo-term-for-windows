"use strict";
window.I18N.register({
    en: { "widget.calc_random": "Random", "cat.tools": "Tools" },
    ru: { "widget.calc_random": "Случайное", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.calc_random = {
    id: "calc_random",
    title: "widget.calc_random",
    category: "tools",
    description: "Random integer in range, dice roller, coin flip",
    defaultSize: { w: 6, h: 6 },
    mount(body) {
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);width:80px";
        const randInt = (min, max) => {
            // inclusive, unbiased via rejection
            const range = max - min + 1;
            if (range <= 0) return min;
            const maxU = Math.floor(0xFFFFFFFF / range) * range;
            const buf = new Uint32Array(1);
            let v;
            do { crypto.getRandomValues(buf); v = buf[0]; } while (v >= maxU);
            return min + (v % range);
        };
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:14px;font-size:13px;padding:2px">
                <div>
                    <div style="color:var(--text-dim);margin-bottom:4px">Integer in range [min, max]</div>
                    <input class="r-min" type="number" style="${inp}" value="1">
                    <span style="color:var(--text-dim)">…</span>
                    <input class="r-max" type="number" style="${inp}" value="100">
                    <button class="r-go" style="margin-left:6px">Roll</button>
                    <span class="r-out" style="margin-left:8px;font-size:16px;color:var(--accent);cursor:pointer" title="copy">—</span>
                </div>
                <div>
                    <div style="color:var(--text-dim);margin-bottom:4px">Dice</div>
                    <input class="d-n" type="number" min="1" style="${inp}" value="2">
                    <span style="color:var(--text-dim)">d</span>
                    <input class="d-s" type="number" min="2" style="${inp}" value="6">
                    <button class="d-go" style="margin-left:6px">Roll</button>
                    <div class="d-out" style="margin-top:6px;font-family:var(--font-mono)"></div>
                </div>
                <div>
                    <div style="color:var(--text-dim);margin-bottom:4px">Coin</div>
                    <button class="c-go">Flip</button>
                    <b class="c-out" style="margin-left:8px;font-size:16px">—</b>
                </div>
            </div>`;
        const q = c => body.querySelector(c);
        const rmin = q(".r-min"), rmax = q(".r-max"), rgo = q(".r-go"), rout = q(".r-out");
        const dn = q(".d-n"), ds = q(".d-s"), dgo = q(".d-go"), dout = q(".d-out");
        const cgo = q(".c-go"), cout = q(".c-out");
        const rollRange = () => {
            let a = Math.floor(Number(rmin.value)), b = Math.floor(Number(rmax.value));
            if (!Number.isFinite(a) || !Number.isFinite(b)) { rout.textContent = "—"; return; }
            if (a > b) { const t = a; a = b; b = t; }
            const v = randInt(a, b);
            rout.textContent = String(v);
            rout.onclick = () => navigator.clipboard.writeText(String(v));
        };
        const rollDice = () => {
            let n = Math.floor(Number(dn.value)), s = Math.floor(Number(ds.value));
            if (!Number.isFinite(n) || !Number.isFinite(s) || n < 1 || s < 2 || n > 1000) { dout.textContent = "invalid"; return; }
            const rolls = [];
            for (let i = 0; i < n; i++) rolls.push(randInt(1, s));
            const sum = rolls.reduce((a, b) => a + b, 0);
            dout.innerHTML = `<span style="color:var(--text-dim)">rolls</span> ${rolls.join(" + ")} <span style="color:var(--text-dim)">=</span> <b style="color:var(--accent);cursor:pointer" class="d-sum" title="copy">${sum}</b>`;
            const ds2 = dout.querySelector(".d-sum");
            if (ds2) ds2.onclick = () => navigator.clipboard.writeText(String(sum));
        };
        const flip = () => {
            const h = randInt(0, 1) === 0;
            cout.textContent = h ? "Heads" : "Tails";
            cout.style.color = h ? "var(--accent)" : "var(--text)";
        };
        rgo.onclick = rollRange; dgo.onclick = rollDice; cgo.onclick = flip;
        rollRange(); rollDice();
        return { destroy() { rgo.onclick = dgo.onclick = cgo.onclick = null; rout.onclick = null; } };
    }
};
