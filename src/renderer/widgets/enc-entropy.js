"use strict";
window.I18N.register({
    en: { "widget.enc_entropy": "Password Entropy", "cat.security": "Security" },
    ru: { "widget.enc_entropy": "Энтропия пароля", "cat.security": "Безопасность" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.enc_entropy = {
    id: "enc_entropy",
    title: "widget.enc_entropy",
    category: "security",
    description: "Shannon entropy, charset analysis and crack-time estimate for a string",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        let alive = true;
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <input class="_in" placeholder="Type or paste a password/string" spellcheck="false" autocomplete="off" style="font-family:var(--font-mono);font-size:14px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px 10px">
            <div class="bar" style="height:8px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:4px;overflow:hidden"><i class="_bar" style="display:block;height:100%;width:0%;background:var(--danger);transition:width .15s,background .15s"></i></div>
            <div style="display:flex;flex-direction:column;gap:3px">
              <div class="metric-row"><span class="k" style="color:var(--text-dim)">Length</span><span class="v _len" style="font-variant-numeric:tabular-nums">0</span></div>
              <div class="metric-row"><span class="k" style="color:var(--text-dim)">Charset pool</span><span class="v _pool" style="font-variant-numeric:tabular-nums">0</span></div>
              <div class="metric-row"><span class="k" style="color:var(--text-dim)">Pool entropy</span><span class="v _bits" style="font-variant-numeric:tabular-nums">0 bits</span></div>
              <div class="metric-row"><span class="k" style="color:var(--text-dim)">Shannon (observed)</span><span class="v _sh" style="font-variant-numeric:tabular-nums">0 bits</span></div>
              <div class="metric-row"><span class="k" style="color:var(--text-dim)">Guesses @1e10/s</span><span class="v _crack">—</span></div>
            </div>
            <div class="_classes" style="color:var(--text-dim);font-size:11px;margin-top:auto"></div>
          </div>`;
        const $ = s => body.querySelector(s);
        const fmtTime = sec => {
            if (!isFinite(sec)) return "eternity";
            if (sec < 1) return "instant";
            const u = [["year", 31557600], ["day", 86400], ["hour", 3600], ["min", 60], ["sec", 1]];
            if (sec > 31557600 * 1000) {
                const yrs = sec / 31557600;
                if (yrs > 1e12) return yrs.toExponential(1) + " yr";
                return Math.round(yrs).toLocaleString(window.I18N.locale()) + " yr";
            }
            for (const [name, s] of u) { if (sec >= s) { const n = Math.floor(sec / s); return n + " " + name + (n !== 1 ? "s" : ""); } }
            return "instant";
        };
        const analyze = () => {
            const s = $("._in").value;
            const len = s.length;
            $("._len").textContent = len;
            if (!len) {
                $("._pool").textContent = "0"; $("._bits").textContent = "0 bits"; $("._sh").textContent = "0 bits";
                $("._crack").textContent = "—"; $("._classes").textContent = ""; $("._bar").style.width = "0%";
                return;
            }
            let pool = 0;
            const has = { lower: /[a-z]/.test(s), upper: /[A-Z]/.test(s), digit: /[0-9]/.test(s), symbol: /[^a-zA-Z0-9]/.test(s), space: /\s/.test(s) };
            if (has.lower) pool += 26;
            if (has.upper) pool += 26;
            if (has.digit) pool += 10;
            if (has.symbol) pool += 33;
            const poolBits = len * Math.log2(pool || 1);
            // Shannon entropy over observed char frequencies (total information content)
            const freq = {};
            for (const c of s) freq[c] = (freq[c] || 0) + 1;
            let hPer = 0;
            for (const k in freq) { const p = freq[k] / len; hPer -= p * Math.log2(p); }
            const shTotal = hPer * len;
            $("._pool").textContent = pool;
            $("._bits").textContent = poolBits.toFixed(1) + " bits";
            $("._sh").textContent = shTotal.toFixed(1) + " bits";
            const guesses = Math.pow(2, poolBits) / 2;
            $("._crack").textContent = fmtTime(guesses / 1e10);
            const cls = Object.keys(has).filter(k => has[k]);
            $("._classes").textContent = "Classes: " + (cls.length ? cls.join(", ") : "none");
            const pct = Math.max(2, Math.min(100, Math.round(poolBits / 128 * 100)));
            $("._bar").style.width = pct + "%";
            $("._bar").style.background = poolBits < 40 ? "var(--danger)" : poolBits < 70 ? "var(--accent2)" : "var(--accent)";
        };
        $("._in").oninput = analyze;
        analyze();
        return { destroy: () => { alive = false; } };
    }
};
