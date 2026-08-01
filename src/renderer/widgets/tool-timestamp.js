"use strict";
window.I18N.register({
    en: { "widget.tool_timestamp": "Timestamp Tool", "cat.tools": "Tools" },
    ru: { "widget.tool_timestamp": "Инструмент Времени", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.tool_timestamp = {
    id: "tool_timestamp",
    title: "widget.tool_timestamp",
    category: "tools",
    description: "Epoch <-> human, both directions",
    defaultSize: { w: 8, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono);font-size:12px";
        const btn = "background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;font-family:var(--font-mono);font-size:11px;cursor:pointer;font-weight:600";
        const sbtn = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-family:var(--font-mono);font-size:11px;cursor:pointer";
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:8px;height:100%">
                <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                    <button class="ts-now" style="${btn}">Now</button>
                    <button class="ts-unit" style="${sbtn}">unit: sec</button>
                    <button class="ts-tz" style="${sbtn}">TZ: local</button>
                    <span class="ts-live" style="font-size:11px;color:var(--text-dim);font-variant-numeric:tabular-nums"></span>
                </div>
                <div style="display:flex;flex-direction:column;gap:3px">
                    <label style="font-size:11px;color:var(--text-dim)">Epoch → Human</label>
                    <input class="ts-ep" placeholder="epoch" style="${inp}" />
                    <div class="ts-ephuman" style="font-size:12px;color:var(--accent);min-height:16px"></div>
                </div>
                <div style="display:flex;flex-direction:column;gap:3px">
                    <label style="font-size:11px;color:var(--text-dim)">Human → Epoch</label>
                    <input class="ts-hu" placeholder="2026-08-01 12:00:00" style="${inp}" />
                    <div class="ts-huep" style="font-size:12px;color:var(--accent);min-height:16px"></div>
                </div>
            </div>`;
        const now = body.querySelector(".ts-now");
        const unitBtn = body.querySelector(".ts-unit");
        const tzBtn = body.querySelector(".ts-tz");
        const live = body.querySelector(".ts-live");
        const epIn = body.querySelector(".ts-ep");
        const epHuman = body.querySelector(".ts-ephuman");
        const huIn = body.querySelector(".ts-hu");
        const huEp = body.querySelector(".ts-huep");
        let ms = false, utc = false, alive = true;

        const fmt = d => {
            if (isNaN(d.getTime())) return "invalid";
            if (utc) return d.toUTCString();
            return d.toLocaleString() + " (" + Intl.DateTimeFormat().resolvedOptions().timeZone + ")";
        };
        const runEp = () => {
            const raw = epIn.value.trim();
            if (!raw) { epHuman.textContent = ""; return; }
            let n = Number(raw);
            if (isNaN(n)) { epHuman.innerHTML = `<span style="color:var(--danger)">not a number</span>`; return; }
            const d = new Date(ms ? n : n * 1000);
            epHuman.textContent = fmt(d);
        };
        const runHu = () => {
            const raw = huIn.value.trim();
            if (!raw) { huEp.textContent = ""; return; }
            const d = new Date(raw);
            if (isNaN(d.getTime())) { huEp.innerHTML = `<span style="color:var(--danger)">unparseable</span>`; return; }
            const v = ms ? d.getTime() : Math.floor(d.getTime() / 1000);
            huEp.textContent = v + (ms ? " ms" : " s");
        };
        now.onclick = () => {
            const t = Date.now();
            epIn.value = ms ? t : Math.floor(t / 1000);
            runEp();
        };
        unitBtn.onclick = () => { ms = !ms; unitBtn.textContent = "unit: " + (ms ? "ms" : "sec"); runEp(); runHu(); };
        tzBtn.onclick = () => { utc = !utc; tzBtn.textContent = "TZ: " + (utc ? "UTC" : "local"); runEp(); runHu(); };
        epIn.oninput = runEp;
        huIn.oninput = runHu;
        const iv = setInterval(() => {
            if (!alive) return;
            const t = Date.now();
            live.textContent = "now: " + (ms ? t : Math.floor(t / 1000));
        }, 1000);
        live.textContent = "now: " + Math.floor(Date.now() / 1000);
        epIn.value = Math.floor(Date.now() / 1000); runEp();
        return { destroy() { alive = false; clearInterval(iv); now.onclick = unitBtn.onclick = tzBtn.onclick = epIn.oninput = huIn.oninput = null; } };
    }
};
