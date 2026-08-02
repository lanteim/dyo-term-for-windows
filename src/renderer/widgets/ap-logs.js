"use strict";
// Logs widget — commissioned by A. Petrov. Recent journalctl lines, level filter, optional
// unit, client-side search, level-based coloring. Linux/systemd only.
const WARN = "#fbbf24"; // matches the existing .apw-chip.warn yellow

// journalctl -o short-iso has no priority column, so infer level from text.
function levelColor(text) {
    const s = text.toLowerCase();
    if (/\b(err|error|errors|fail|failed|failure|fatal|crit|critical|panic|segfault|denied|refused|unable)\b/.test(s)) return "var(--danger)";
    if (/\b(warn|warning|deprecat|timeout|timed out|retry|retrying)\b/.test(s)) return WARN;
    return "var(--text)";
}

window.APWidget.define({
    id: "ap-logs",
    title: "ap.logs.title",
    category: "apetrov",
    description: "journalctl tail · level filter · unit · client-side search",
    defaultSize: { w: 12, h: 6 },
    interval: 5000,
    ranges: false,
    i18n: { en: { "ap.logs.title": "Logs" }, ru: { "ap.logs.title": "Логи" } },
    settings: [
        { key: "interval", label: "Refresh interval (ms)", type: "number", default: 5000 },
        { key: "level", label: "Max level (-p)", type: "select", default: "warning", options: ["err", "warning", "info", "debug"] },
        { key: "unit", label: "Unit (optional)", type: "text", default: "", placeholder: "e.g. sshd.service" },
    ],
    render(ctx) {
        ctx.body.innerHTML = `
            <div style="display:flex;gap:6px;align-items:center;position:sticky;top:0;background:var(--bg);padding:1px 0 6px;z-index:1">
                <input data-ref="q" placeholder="filter lines…" style="flex:1;min-width:120px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 7px;font-family:var(--font-mono);font-size:11.5px"/>
                <span data-ref="count" class="apw-chip">0</span>
            </div>
            <div data-ref="out" style="font-family:var(--font-mono);font-size:11px;line-height:1.45"></div>`;
        const q = ctx.$('[data-ref="q"]');
        const out = ctx.$('[data-ref="out"]');
        const cnt = ctx.$('[data-ref="count"]');
        ctx.log = { lines: [] };
        // Re-render the visible list from cached lines + current filter (no exec).
        ctx.draw = () => {
            const term = (q.value || "").trim().toLowerCase();
            const shown = term ? ctx.log.lines.filter(l => l.text.toLowerCase().includes(term)) : ctx.log.lines;
            cnt.textContent = term ? shown.length + "/" + ctx.log.lines.length : String(ctx.log.lines.length);
            out.innerHTML = shown.length
                ? shown.map(l => `<div style="color:${l.color};white-space:pre-wrap;word-break:break-word">${ctx.fmt.esc(l.text)}</div>`).join("")
                : `<div style="color:var(--text-dim)">${term ? "no matching lines" : "no log entries"}</div>`;
        };
        q.addEventListener("input", ctx.draw);
    },
    async update(ctx) {
        const level = ctx.settings.level || "warning";
        const unit = (ctx.settings.unit || "").trim();
        const args = ["-n", "120", "--no-pager", "-o", "short-iso", "-p", level];
        if (unit) args.push("--unit", unit);

        let res;
        try {
            res = await ctx.exec("journalctl", args, { timeout: 8000 });
        } catch (e) {
            ctx.notAvailable("journalctl unavailable — Linux/systemd only");
            return;
        }
        if (!res) { ctx.notAvailable("journalctl unavailable — Linux/systemd only"); return; }

        const err = (res.stderr || "").toLowerCase();
        if (res.code === 127 || err.includes("enoent") || err.includes("not found") || err.includes("no such file")) {
            ctx.notAvailable("journalctl not found — Linux/systemd only");
            return;
        }

        const lines = (res.stdout || "").split("\n").map(s => s.replace(/\s+$/, "")).filter(Boolean);
        ctx.log.lines = lines.map(text => ({ text, color: levelColor(text) }));
        ctx.draw();

        if (res.code !== 0 && !lines.length) {
            ctx.setStatus((res.stderr || "journalctl error").split("\n")[0].slice(0, 120), "err");
        } else {
            const meta = `${lines.length} lines · -p ${level}${unit ? " · " + unit : ""} · ${new Date().toLocaleTimeString()}`;
            ctx.setStatus(meta);
        }
    },
});
