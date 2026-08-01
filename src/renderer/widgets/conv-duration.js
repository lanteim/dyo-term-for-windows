"use strict";
window.I18N.register({
    en: { "widget.conv_duration": "Duration Converter", "cat.tools": "Tools" },
    ru: { "widget.conv_duration": "Конвертер длительности", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.conv_duration = {
    id: "conv_duration",
    title: "widget.conv_duration",
    category: "tools",
    description: "Total seconds <-> days/hours/minutes/seconds, both directions",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:12px;width:100%;box-sizing:border-box";
        const lbl = "color:var(--text-dim);font-size:11px;margin-bottom:2px";
        const copyBtn = "background:var(--bg-elevated);color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:4px 8px;cursor:pointer;font-family:var(--font-mono);font-size:11px";

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:10px;height:100%;overflow:auto;font-family:var(--font-mono)">
            <div>
              <div style="${lbl}">Total seconds</div>
              <div style="display:flex;gap:6px"><input class="_sec" spellcheck="false" style="${inp}" placeholder="90061"><button class="_csec" style="${copyBtn}">copy</button></div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">
              <div><div style="${lbl}">days</div><input class="_d" spellcheck="false" style="${inp}"></div>
              <div><div style="${lbl}">hours</div><input class="_h" spellcheck="false" style="${inp}"></div>
              <div><div style="${lbl}">mins</div><input class="_m" spellcheck="false" style="${inp}"></div>
              <div><div style="${lbl}">secs</div><input class="_s" spellcheck="false" style="${inp}"></div>
            </div>
            <div>
              <div style="${lbl}">Human readable</div>
              <div style="display:flex;gap:6px"><input class="_hr" readonly spellcheck="false" style="${inp}"><button class="_chr" style="${copyBtn}">copy</button></div>
            </div>
            <div class="_msg" style="${lbl};margin-top:auto"></div>
          </div>`;
        const $ = s => body.querySelector(s);
        const secEl = $("._sec"), dEl = $("._d"), hEl = $("._h"), mEl = $("._m"), sEl = $("._s"), hr = $("._hr"), msg = $("._msg");

        const renderFromSeconds = total => {
            if (!isFinite(total) || total < 0) { msg.textContent = "invalid"; return; }
            let t = Math.floor(total);
            const d = Math.floor(t / 86400); t -= d * 86400;
            const h = Math.floor(t / 3600); t -= h * 3600;
            const m = Math.floor(t / 60); const s = t - m * 60;
            dEl.value = d; hEl.value = h; mEl.value = m; sEl.value = s;
            const parts = [];
            if (d) parts.push(d + "d");
            if (h) parts.push(h + "h");
            if (m) parts.push(m + "m");
            if (s || !parts.length) parts.push(s + "s");
            hr.value = parts.join(" ");
            msg.textContent = "";
        };
        const fromSeconds = () => {
            const raw = secEl.value.trim();
            if (raw === "") { dEl.value = hEl.value = mEl.value = sEl.value = hr.value = ""; msg.textContent = ""; return; }
            const n = Number(raw);
            if (!isFinite(n)) { msg.textContent = "invalid number"; return; }
            renderFromSeconds(n);
        };
        const fromParts = () => {
            const d = Number(dEl.value) || 0, h = Number(hEl.value) || 0, m = Number(mEl.value) || 0, s = Number(sEl.value) || 0;
            if ([d, h, m, s].some(v => !isFinite(v))) { msg.textContent = "invalid"; return; }
            const total = d * 86400 + h * 3600 + m * 60 + s;
            secEl.value = String(total);
            const parts = [];
            if (d) parts.push(d + "d"); if (h) parts.push(h + "h"); if (m) parts.push(m + "m");
            if (s || !parts.length) parts.push(s + "s");
            hr.value = parts.join(" "); msg.textContent = "";
        };

        secEl.addEventListener("input", fromSeconds);
        [dEl, hEl, mEl, sEl].forEach(e => e.addEventListener("input", fromParts));
        const cp = v => { if (v) navigator.clipboard.writeText(v).catch(() => {}); };
        $("._csec").onclick = () => cp(secEl.value);
        $("._chr").onclick = () => cp(hr.value);
        secEl.value = "90061"; fromSeconds();

        return { destroy() {} };
    }
};
