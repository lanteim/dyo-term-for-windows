"use strict";
window.I18N.register({
    en: { "widget.sec_cve": "Vuln Scan", "cat.security": "Security" },
    ru: { "widget.sec_cve": "Уязвимости", "cat.security": "Безопасность" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.sec_cve = {
    id: "sec_cve",
    title: "widget.sec_cve",
    category: "security",
    description: "Dependency vulnerabilities via npm audit or trivy fs",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
              <div style="display:flex;align-items:center;gap:8px">
                <span class="_cv_src" style="color:var(--text-dim)">—</span>
                <button class="_cv_go" style="margin-left:auto;background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px">Scan</button>
              </div>
              <div class="_cv_out" style="flex:1;overflow:auto"><div style="color:var(--text-dim)">Press Scan to check the current project folder.</div></div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const cwd = () => (window.term ? window.term.lastCwd : undefined);

        const SEV = [
            { k: "critical", c: "var(--danger)" },
            { k: "high", c: "var(--danger)" },
            { k: "moderate", c: "var(--accent2)" },
            { k: "low", c: "var(--text-dim)" },
            { k: "info", c: "var(--text-dim)" }
        ];

        const renderCounts = (counts, total, srcLabel) => {
            $("._cv_src").textContent = srcLabel;
            const max = Math.max(1, ...SEV.map(s => counts[s.k] || 0));
            let html = `<div class="metric-row"><span class="k">TOTAL</span><span class="v"><b style="font-size:15px;color:${total ? "var(--danger)" : "var(--accent)"}">${total}</b></span></div>`;
            SEV.forEach(s => {
                const n = counts[s.k] || 0;
                html += `<div class="metric-row"><span class="k" style="text-transform:uppercase">${s.k}</span>
                    <span class="v" style="display:flex;align-items:center;gap:8px">
                      <span class="bar" style="width:90px;background:var(--bg-elevated);border-radius:4px;overflow:hidden;height:8px"><i style="display:block;height:100%;width:${Math.round((n / max) * 100)}%;background:${s.c}"></i></span>
                      <b style="min-width:24px;text-align:right;color:${n ? s.c : "var(--text-dim)"}">${n}</b>
                    </span></div>`;
            });
            $("._cv_out").innerHTML = html;
        };

        const runNpm = async (c) => {
            const r = await window.dyo.exec("npm", ["audit", "--json"], { cwd: c, timeout: 60000 });
            const out = (r && r.stdout || "").trim();
            if (!out) return { ok: false, msg: (r && r.stderr && r.stderr.trim().split("\n")[0]) || "npm audit produced no output" };
            let j;
            try { j = JSON.parse(out); } catch (e) { return { ok: false, msg: "could not parse npm audit output" }; }
            const v = (j.metadata && j.metadata.vulnerabilities) || j.vulnerabilities || {};
            const counts = { critical: v.critical || 0, high: v.high || 0, moderate: v.moderate || 0, low: v.low || 0, info: v.info || 0 };
            const total = (typeof v.total === "number") ? v.total : SEV.reduce((a, s) => a + (counts[s.k] || 0), 0);
            return { ok: true, counts, total, label: "npm audit" };
        };

        const runTrivy = async (c) => {
            const r = await window.dyo.exec("trivy", ["fs", "--quiet", "--format", "json", "."], { cwd: c, timeout: 90000 });
            const out = (r && r.stdout || "").trim();
            if (!out) return { ok: false, msg: (r && r.stderr && r.stderr.trim().split("\n")[0]) || "trivy not available" };
            let j;
            try { j = JSON.parse(out); } catch (e) { return { ok: false, msg: "could not parse trivy output" }; }
            const counts = { critical: 0, high: 0, moderate: 0, low: 0, info: 0 };
            const map = { CRITICAL: "critical", HIGH: "high", MEDIUM: "moderate", LOW: "low", UNKNOWN: "info" };
            (j.Results || []).forEach(res => (res.Vulnerabilities || []).forEach(v => {
                const k = map[v.Severity] || "info"; counts[k]++;
            }));
            const total = SEV.reduce((a, s) => a + counts[s.k], 0);
            return { ok: true, counts, total, label: "trivy fs" };
        };

        const scan = async () => {
            if (busy) return;
            busy = true;
            $("._cv_go").disabled = true;
            try {
                const c = cwd();
                if (!c) { $("._cv_out").innerHTML = `<div style="color:var(--text-dim)">No project folder (open one in the terminal).</div>`; $("._cv_src").textContent = "—"; return; }
                const pkg = await window.dyo.fs.stat(c + "/package.json").catch(() => null);
                const hasPkg = pkg && !pkg.error;
                $("._cv_out").innerHTML = `<div style="color:var(--text-dim)">Scanning ${hasPkg ? "npm dependencies" : "filesystem (trivy)"}…</div>`;
                let res = hasPkg ? await runNpm(c) : await runTrivy(c);
                if (!alive) return;
                if (!res.ok && hasPkg) { /* npm failed, try trivy as fallback */ const t = await runTrivy(c); if (t.ok) res = t; }
                if (!alive) return;
                if (res.ok) renderCounts(res.counts, res.total, res.label + " · " + c.split("/").pop());
                else { $("._cv_src").textContent = "—"; $("._cv_out").innerHTML = `<div style="color:var(--danger)">${esc(res.msg)}</div><div style="color:var(--text-dim);margin-top:4px">Need npm (with package.json) or trivy on PATH.</div>`; }
            } catch (e) {
                if (alive) $("._cv_out").innerHTML = `<div style="color:var(--danger)">Error: ${esc(e && e.message)}</div>`;
            } finally {
                if (alive) $("._cv_go").disabled = false;
                busy = false;
            }
        };
        $("._cv_go").onclick = scan;

        return { destroy: () => { alive = false; } };
    }
};
