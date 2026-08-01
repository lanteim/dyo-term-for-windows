"use strict";
window.I18N.register({
    en: { "widget.conv_epoch": "Epoch Converter", "cat.tools": "Tools" },
    ru: { "widget.conv_epoch": "Конвертер Epoch", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.conv_epoch = {
    id: "conv_epoch",
    title: "widget.conv_epoch",
    category: "tools",
    description: "Unix epoch <-> human date, seconds/milliseconds, local & UTC",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:12px";
        const lbl = "color:var(--text-dim);font-size:11px;margin-bottom:2px";
        const copyBtn = "background:var(--bg-elevated);color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:4px 8px;cursor:pointer;font-family:var(--font-mono);font-size:11px";

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:8px;height:100%;overflow:auto;font-family:var(--font-mono)">
            <div style="display:flex;gap:6px;align-items:center">
              <div style="${lbl};margin:0">Epoch</div>
              <input class="_ep" spellcheck="false" style="${inp};flex:1" placeholder="1700000000">
              <select class="_unit" style="${inp}"><option value="s">sec</option><option value="ms">ms</option></select>
              <button class="_now" style="${copyBtn}">now</button>
            </div>
            <div>
              <div style="${lbl}">Local (this machine)</div>
              <div style="display:flex;gap:6px"><input class="_loc" spellcheck="false" style="${inp};flex:1" placeholder="YYYY-MM-DD HH:MM:SS"><button class="_cloc" style="${copyBtn}">copy</button></div>
            </div>
            <div>
              <div style="${lbl}">UTC</div>
              <div style="display:flex;gap:6px"><input class="_utc" spellcheck="false" readonly style="${inp};flex:1"><button class="_cutc" style="${copyBtn}">copy</button></div>
            </div>
            <div>
              <div style="${lbl}">ISO 8601</div>
              <div style="display:flex;gap:6px"><input class="_iso" spellcheck="false" readonly style="${inp};flex:1"><button class="_ciso" style="${copyBtn}">copy</button></div>
            </div>
            <div class="_rel" style="${lbl};margin-top:auto"></div>
          </div>`;
        const $ = s => body.querySelector(s);
        const ep = $("._ep"), unit = $("._unit"), loc = $("._loc"), utc = $("._utc"), iso = $("._iso"), rel = $("._rel");

        const pad = (n, l = 2) => String(n).padStart(l, "0");
        const fmtLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        const fmtUTC = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
        const relative = ms => {
            const diff = Date.now() - ms, a = Math.abs(diff), s = Math.round(a / 1000);
            const units = [[86400, "day"], [3600, "hour"], [60, "min"], [1, "sec"]];
            for (const [sec, name] of units) { if (s >= sec) { const v = Math.floor(s / sec); return `${v} ${name}${v !== 1 ? "s" : ""} ${diff >= 0 ? "ago" : "from now"}`; } }
            return "just now";
        };

        const fromEpoch = () => {
            const raw = ep.value.trim();
            if (!raw) { loc.value = utc.value = iso.value = ""; rel.textContent = ""; return; }
            let num = Number(raw);
            if (!isFinite(num)) { rel.textContent = "invalid number"; return; }
            const ms = unit.value === "ms" ? num : num * 1000;
            const d = new Date(ms);
            if (isNaN(d.getTime())) { rel.textContent = "out of range"; return; }
            loc.value = fmtLocal(d); utc.value = fmtUTC(d); iso.value = d.toISOString();
            rel.textContent = relative(ms);
        };
        const fromLocal = () => {
            const raw = loc.value.trim();
            if (!raw) return;
            const m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
            let d;
            if (m) d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
            else d = new Date(raw);
            if (isNaN(d.getTime())) { rel.textContent = "unparseable date"; return; }
            const ms = d.getTime();
            ep.value = unit.value === "ms" ? String(ms) : String(Math.floor(ms / 1000));
            utc.value = fmtUTC(d); iso.value = d.toISOString(); rel.textContent = relative(ms);
        };

        ep.addEventListener("input", fromEpoch);
        unit.addEventListener("change", fromEpoch);
        loc.addEventListener("input", fromLocal);
        const now = () => { ep.value = String(Math.floor(Date.now() / (unit.value === "ms" ? 1 : 1000))); fromEpoch(); };
        $("._now").onclick = now;
        const cp = v => { if (v) navigator.clipboard.writeText(v).catch(() => {}); };
        $("._cloc").onclick = () => cp(loc.value);
        $("._cutc").onclick = () => cp(utc.value);
        $("._ciso").onclick = () => cp(iso.value);
        now();

        return { destroy() {} };
    }
};
