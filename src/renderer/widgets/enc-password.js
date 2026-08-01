"use strict";
window.I18N.register({
    en: { "widget.enc_password": "Password Generator", "cat.security": "Security" },
    ru: { "widget.enc_password": "Генератор паролей", "cat.security": "Безопасность" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.enc_password = {
    id: "enc_password",
    title: "widget.enc_password",
    category: "security",
    description: "Generate a strong random password (length + char classes + strength meter)",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        let alive = true;
        const SETS = {
            lower: "abcdefghijklmnopqrstuvwxyz",
            upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
            digits: "0123456789",
            symbols: "!@#$%^&*()-_=+[]{};:,.<>?/|~"
        };
        const AMBIG = new Set("O0oIl1|S5B8".split(""));

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div style="display:flex;gap:6px;align-items:center">
              <input class="_out" readonly style="flex:1;font-family:var(--font-mono);font-size:14px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px 10px;word-break:break-all">
              <button class="_copy" title="Copy" style="background:transparent;color:var(--text);border:1px solid var(--accent);border-radius:6px;padding:8px 12px;cursor:pointer;font-family:var(--font-mono)">Copy</button>
              <button class="_gen" title="Regenerate" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px 12px;cursor:pointer;font-family:var(--font-mono)">↻</button>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="color:var(--text-dim);min-width:56px">Length</span>
              <input class="_len" type="range" min="6" max="64" value="20" style="flex:1">
              <span class="_lenv" style="min-width:26px;text-align:right;font-variant-numeric:tabular-nums">20</span>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:10px;color:var(--text-dim)">
              <label style="cursor:pointer"><input type="checkbox" class="_lower" checked> a-z</label>
              <label style="cursor:pointer"><input type="checkbox" class="_upper" checked> A-Z</label>
              <label style="cursor:pointer"><input type="checkbox" class="_digits" checked> 0-9</label>
              <label style="cursor:pointer"><input type="checkbox" class="_symbols" checked> !@#</label>
              <label style="cursor:pointer"><input type="checkbox" class="_noambig"> no ambiguous</label>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <div class="bar" style="flex:1;height:8px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:4px;overflow:hidden"><i class="_bar" style="display:block;height:100%;width:0%;background:var(--danger);transition:width .15s,background .15s"></i></div>
              <span class="_label" style="min-width:64px;text-align:right"></span>
            </div>
            <div class="_ent" style="color:var(--text-dim);font-family:var(--font-mono)"></div>
          </div>`;
        const $ = s => body.querySelector(s);
        const out = $("._out");

        const pool = () => {
            let p = "";
            if ($("._lower").checked) p += SETS.lower;
            if ($("._upper").checked) p += SETS.upper;
            if ($("._digits").checked) p += SETS.digits;
            if ($("._symbols").checked) p += SETS.symbols;
            if ($("._noambig").checked) p = p.split("").filter(c => !AMBIG.has(c)).join("");
            return p;
        };
        const rand = n => {
            const a = new Uint32Array(1);
            // rejection sampling to avoid modulo bias
            const limit = Math.floor(0xFFFFFFFF / n) * n;
            let x;
            do { crypto.getRandomValues(a); x = a[0]; } while (x >= limit);
            return x % n;
        };
        const gen = () => {
            const p = pool();
            const len = +$("._len").value;
            if (!p) { out.value = ""; setStrength(0, len, ""); return; }
            let s = "";
            for (let i = 0; i < len; i++) s += p[rand(p.length)];
            out.value = s;
            const bits = len * Math.log2(p.length);
            setStrength(bits, len, p);
        };
        const setStrength = (bits, len, p) => {
            const pct = Math.max(2, Math.min(100, Math.round(bits / 128 * 100)));
            $("._bar").style.width = pct + "%";
            let label, color;
            if (bits < 40) { label = "Weak"; color = "var(--danger)"; }
            else if (bits < 70) { label = "Fair"; color = "var(--accent2)"; }
            else if (bits < 100) { label = "Strong"; color = "var(--accent)"; }
            else { label = "Very strong"; color = "var(--accent)"; }
            $("._bar").style.background = color;
            $("._label").textContent = p ? label : "—";
            $("._label").style.color = color;
            $("._ent").textContent = p ? `${bits.toFixed(1)} bits entropy · pool ${p.length} chars` : "Select at least one character class";
        };

        $("._len").oninput = () => { $("._lenv").textContent = $("._len").value; gen(); };
        ["._lower", "._upper", "._digits", "._symbols", "._noambig"].forEach(s => $(s).onchange = gen);
        $("._gen").onclick = gen;
        $("._copy").onclick = () => { if (out.value) navigator.clipboard.writeText(out.value).then(() => { const b = $("._copy"); b.textContent = "✓"; setTimeout(() => { if (alive) b.textContent = "Copy"; }, 900); }).catch(() => {}); };
        gen();

        return { destroy: () => { alive = false; } };
    }
};
