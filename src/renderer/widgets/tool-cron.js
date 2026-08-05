"use strict";
window.I18N.register({
    en: { "widget.tool_cron": "Cron Explainer", "cat.tools": "Tools" },
    ru: { "widget.tool_cron": "Разбор Cron", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.tool_cron = {
    id: "tool_cron",
    title: "widget.tool_cron",
    category: "tools",
    description: "Explain a 5-field cron and approximate next run",
    defaultSize: { w: 8, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono);font-size:13px";
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:8px;height:100%">
                <input class="cr-in" value="*/5 9-17 * * 1-5" placeholder="min hour dom mon dow" style="${inp}" />
                <div class="cr-out" style="flex:1;overflow:auto;font-size:12px;display:flex;flex-direction:column;gap:3px"></div>
                <div class="cr-next" style="font-size:12px;color:var(--accent);border-top:1px solid var(--border);padding-top:6px"></div>
            </div>`;
        const cin = body.querySelector(".cr-in");
        const cout = body.querySelector(".cr-out");
        const cnext = body.querySelector(".cr-next");
        const NAMES = ["minute", "hour", "day-of-month", "month", "day-of-week"];
        const RANGES = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]];
        const MON = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        const parseField = (f, idx) => {
            const [lo, hi] = RANGES[idx];
            const set = new Set();
            for (const part of f.split(",")) {
                let step = 1, body2 = part;
                const sl = part.split("/");
                if (sl.length === 2) { body2 = sl[0]; step = parseInt(sl[1], 10) || 1; }
                let a = lo, b = hi;
                if (body2 === "*" || body2 === "") { a = lo; b = hi; }
                else if (body2.indexOf("-") > 0) { const r = body2.split("-"); a = parseInt(r[0], 10); b = parseInt(r[1], 10); }
                else { a = b = parseInt(body2, 10); }
                if (isNaN(a) || isNaN(b)) return null;
                for (let v = a; v <= b; v += step) if (v >= lo && v <= hi) set.add(v);
            }
            return set.size ? set : null;
        };
        const describe = (f, idx) => {
            const [lo, hi] = RANGES[idx];
            if (f === "*") return "every " + NAMES[idx];
            if (/^\*\/\d+$/.test(f)) return "every " + f.split("/")[1] + " " + NAMES[idx] + "s";
            const set = parseField(f, idx);
            if (!set) return "invalid";
            const arr = [...set].sort((a, b) => a - b);
            const fmt = v => idx === 3 ? MON[v] : idx === 4 ? DOW[v % 7] : String(v);
            if (arr.length === (hi - lo + 1)) return "every " + NAMES[idx];
            return NAMES[idx] + " = " + arr.map(fmt).join(", ");
        };

        const run = () => {
            const parts = cin.value.trim().split(/\s+/);
            if (parts.length !== 5) {
                cout.innerHTML = `<span style="color:var(--danger)">Need exactly 5 fields (min hour dom mon dow)</span>`;
                cnext.textContent = ""; return;
            }
            const sets = [];
            let ok = true;
            cout.innerHTML = "";
            parts.forEach((p, i) => {
                const s = parseField(p, i);
                if (!s) ok = false;
                sets.push(s);
                const row = document.createElement("div");
                row.className = "metric-row";
                row.innerHTML = `<span class="k">${esc(p)}</span><span class="v">${esc(describe(p, i))}</span>`;
                cout.appendChild(row);
            });
            if (!ok) { cnext.innerHTML = `<span style="color:var(--danger)">Invalid expression</span>`; return; }
            const [min, hr, dom, mon, dow] = sets;
            let d = new Date();
            d.setSeconds(0, 0);
            d.setMinutes(d.getMinutes() + 1);
            let found = null;
            for (let i = 0; i < 366 * 24 * 60; i++) {
                if (min.has(d.getMinutes()) && hr.has(d.getHours()) && mon.has(d.getMonth() + 1) &&
                    dom.has(d.getDate()) && dow.has(d.getDay())) { found = new Date(d); break; }
                d.setMinutes(d.getMinutes() + 1);
            }
            cnext.textContent = found ? "Next run ≈ " + found.toLocaleString(window.I18N.locale()) : "No run within 1 year";
        };
        cin.oninput = run;
        run();
        return { destroy() { cin.oninput = null; } };
    }
};
