"use strict";
window.I18N.register({
    en: { "widget.extra_currency": "Currency", "cat.tools": "Tools" },
    ru: { "widget.extra_currency": "Валюта", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.extra_currency = {
    id: "extra_currency",
    title: "widget.extra_currency",
    category: "tools",
    description: "Currency converter via frankfurter.app",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        let alive = true, busy = false;
        const CURR = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "CNY", "RUB", "INR", "BRL", "SEK", "NOK", "PLN", "TRY", "MXN", "ZAR", "SGD", "HKD", "NZD"];

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                <input class="_amt" value="100" placeholder="Amount" title="Amount to convert" style="width:100px"/>
                <select class="_from" style="width:80px"></select>
                <span style="color:var(--text-dim)">→</span>
                <select class="_to" style="width:80px"></select>
                <button class="_go">Convert</button>
              </div>
              <div class="_out" style="font-size:24px;font-weight:500;color:var(--accent2);font-variant-numeric:tabular-nums;padding:4px 0">—</div>
              <div class="_rate" style="color:var(--text-dim)"></div>
              <div class="_st" style="color:var(--text-dim);font-size:11px"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        ["._amt", "._from", "._to"].forEach(s => { $(s).style.cssText += ";background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono)"; });
        $("._go").style.cssText += ";background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;cursor:pointer;font-family:var(--font-mono)";
        $("._from").innerHTML = CURR.map(c => `<option>${c}</option>`).join("");
        $("._to").innerHTML = CURR.map(c => `<option>${c}</option>`).join("");
        $("._from").value = "USD"; $("._to").value = "EUR";

        const convert = async () => {
            if (busy || !alive) return;
            const amt = parseFloat($("._amt").value);
            const from = $("._from").value, to = $("._to").value;
            if (isNaN(amt)) { $("._out").textContent = "enter amount"; return; }
            if (from === to) { $("._out").textContent = amt.toFixed(2) + " " + to; $("._rate").textContent = "1.0000"; return; }
            busy = true; $("._st").textContent = "fetching…";
            const r = await window.dyo.http(`https://api.frankfurter.app/latest?amount=${encodeURIComponent(amt)}&from=${from}&to=${to}`, { timeout: 8000 });
            busy = false;
            if (!alive) return;
            if (!r || r.error || !r.ok) { $("._st").textContent = "offline — rates unavailable"; $("._st").style.color = "var(--danger)"; return; }
            try {
                const d = JSON.parse(r.text);
                const val = d.rates && d.rates[to];
                if (typeof val !== "number") throw new Error("no rate");
                $("._out").textContent = val.toFixed(2) + " " + to;
                $("._rate").textContent = `1 ${from} = ${(val / amt).toFixed(4)} ${to}`;
                $("._st").textContent = "as of " + (d.date || "?"); $("._st").style.color = "var(--text-dim)";
            } catch (e) { $("._st").textContent = "bad response"; $("._st").style.color = "var(--danger)"; }
        };
        $("._go").onclick = convert;
        $("._amt").onkeydown = e => { if (e.key === "Enter") convert(); };
        $("._from").onchange = convert; $("._to").onchange = convert;
        convert();

        return { destroy: () => { alive = false; } };
    }
};
