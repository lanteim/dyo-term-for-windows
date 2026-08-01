"use strict";
window.I18N.register({
    en: { "widget.calc_tip": "Tip Split", "cat.tools": "Tools" },
    ru: { "widget.calc_tip": "Чаевые", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.calc_tip = {
    id: "calc_tip",
    title: "widget.calc_tip",
    category: "tools",
    description: "Bill + tip% split across people, per-person total",
    defaultSize: { w: 6, h: 6 },
    mount(body) {
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);width:100px";
        const num = el => { const v = parseFloat(el.value); return el.value.trim() === "" ? NaN : v; };
        const money = n => isFinite(n) ? n.toFixed(2) : "—";
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:10px;font-size:13px;padding:2px">
                <label style="display:flex;justify-content:space-between;align-items:center">
                    <span style="color:var(--text-dim)">Bill amount</span>
                    <input class="t-bill" type="number" style="${inp}" value="100">
                </label>
                <label style="display:flex;justify-content:space-between;align-items:center">
                    <span style="color:var(--text-dim)">Tip %</span>
                    <input class="t-tip" type="number" style="${inp}" value="18">
                </label>
                <div style="display:flex;gap:6px">
                    <button class="t-q" data-v="10" style="flex:1">10%</button>
                    <button class="t-q" data-v="15" style="flex:1">15%</button>
                    <button class="t-q" data-v="18" style="flex:1">18%</button>
                    <button class="t-q" data-v="20" style="flex:1">20%</button>
                </div>
                <label style="display:flex;justify-content:space-between;align-items:center">
                    <span style="color:var(--text-dim)">Split between</span>
                    <input class="t-ppl" type="number" min="1" style="${inp}" value="2">
                </label>
                <div style="border-top:1px solid var(--border);padding-top:8px;display:flex;flex-direction:column;gap:4px">
                    <div style="display:flex;justify-content:space-between"><span style="color:var(--text-dim)">Tip</span><b class="t-o-tip">—</b></div>
                    <div style="display:flex;justify-content:space-between"><span style="color:var(--text-dim)">Total</span><b class="t-o-total">—</b></div>
                    <div style="display:flex;justify-content:space-between;font-size:15px"><span style="color:var(--text-dim)">Per person</span><b class="t-o-pp" style="color:var(--accent);cursor:pointer" title="copy">—</b></div>
                </div>
            </div>`;
        const q = c => body.querySelector(c);
        const bill = q(".t-bill"), tip = q(".t-tip"), ppl = q(".t-ppl");
        const oTip = q(".t-o-tip"), oTotal = q(".t-o-total"), oPp = q(".t-o-pp");
        const btns = Array.from(body.querySelectorAll(".t-q"));
        const calc = () => {
            const b = num(bill), tp = num(tip), p = num(ppl);
            if (isNaN(b) || isNaN(tp)) { oTip.textContent = oTotal.textContent = oPp.textContent = "—"; return; }
            const tipAmt = b * tp / 100;
            const total = b + tipAmt;
            oTip.textContent = money(tipAmt);
            oTotal.textContent = money(total);
            const per = (!isNaN(p) && p >= 1) ? total / p : NaN;
            const perTxt = money(per);
            oPp.textContent = perTxt;
            oPp.onclick = () => { if (perTxt !== "—") navigator.clipboard.writeText(perTxt); };
        };
        const onQ = e => { tip.value = e.currentTarget.getAttribute("data-v"); calc(); };
        btns.forEach(b => b.onclick = onQ);
        const ins = [bill, tip, ppl];
        ins.forEach(el => el.oninput = calc);
        calc();
        return { destroy() { ins.forEach(el => { el.oninput = null; }); btns.forEach(b => b.onclick = null); oPp.onclick = null; } };
    }
};
