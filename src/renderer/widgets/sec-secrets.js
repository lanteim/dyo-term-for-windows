"use strict";
window.I18N.register({
    en: { "widget.sec_secrets": "Secret Scan", "cat.security": "Security" },
    ru: { "widget.sec_secrets": "Поиск секретов", "cat.security": "Безопасность" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.sec_secrets = {
    id: "sec_secrets",
    title: "widget.sec_secrets",
    category: "security",
    description: "Scan project for leaked secrets (gitleaks or ripgrep)",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
              <div style="display:flex;align-items:center;gap:8px">
                <span class="_sc_src" style="color:var(--text-dim)">—</span>
                <button class="_sc_go" style="margin-left:auto;background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px">Scan</button>
              </div>
              <div class="_sc_out" style="flex:1;overflow:auto"><div style="color:var(--text-dim)">Press Scan to check the current project folder.</div></div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const cwd = () => (window.term ? window.term.lastCwd : undefined);

        const renderRows = (rows, srcLabel) => {
            $("._sc_src").textContent = srcLabel;
            if (!rows.length) { $("._sc_out").innerHTML = `<div style="color:var(--accent)">✓ No secrets detected.</div>`; return; }
            let html = `<div style="color:var(--danger);margin-bottom:6px">⚠ ${rows.length} potential secret${rows.length === 1 ? "" : "s"}</div>`;
            html += `<div style="display:flex;flex-direction:column;gap:4px;font-family:var(--font-mono);font-size:11px">`;
            rows.slice(0, 200).forEach(r => {
                html += `<div style="border-bottom:1px solid var(--border);padding-bottom:3px">
                    <div style="color:var(--accent2)">${esc(r.rule)}</div>
                    <div style="color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.file)}${r.line ? ":" + esc(String(r.line)) : ""}</div>
                    ${r.match ? `<div style="color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.match)}</div>` : ""}
                </div>`;
            });
            html += `</div>`;
            $("._sc_out").innerHTML = html;
        };

        const runGitleaks = async (c) => {
            const ver = await window.dyo.exec("gitleaks", ["version"], { timeout: 5000 });
            if (!ver || (ver.code !== 0 && !(ver.stdout || "").trim())) return null; // not present
            const r = await window.dyo.exec("gitleaks", ["detect", "--source", c, "--no-git", "-f", "json", "-r", "/dev/stdout", "--exit-code", "0", "--redact"], { cwd: c, timeout: 60000 });
            const out = (r && r.stdout || "").trim();
            let j = [];
            if (out) { try { j = JSON.parse(out); } catch (e) { j = []; } }
            const rows = (Array.isArray(j) ? j : []).map(f => ({
                rule: f.RuleID || f.Description || "secret",
                file: (f.File || "").replace(c + "/", "").replace(c, "") || f.File || "",
                line: f.StartLine || 0,
                match: f.Secret || f.Match || ""
            }));
            return { rows, label: "gitleaks · " + c.split("/").pop() };
        };

        const runRg = async (c) => {
            const patterns = [
                ["AWS Access Key", "AKIA[0-9A-Z]{16}"],
                ["Private Key", "-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----"],
                ["Generic API key", "(?i)(api[_-]?key|secret|token|passwd|password)['\"]?\\s*[:=]\\s*['\"][0-9A-Za-z_\\-]{16,}['\"]"],
                ["Slack token", "xox[baprs]-[0-9A-Za-z-]{10,}"],
                ["Google API key", "AIza[0-9A-Za-z_\\-]{35}"],
                ["JWT", "eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}"]
            ];
            const args = ["-n", "--no-heading", "--color", "never", "-o", "--max-columns", "160",
                "-g", "!.git", "-g", "!node_modules", "-g", "!*.min.js", "-g", "!*.lock"];
            patterns.forEach(p => { args.push("-e", p[1]); });
            args.push(".");
            const r = await window.dyo.exec("rg", args, { cwd: c, timeout: 30000 });
            if (!r || (r.code > 1) || /ENOENT/.test(r.stderr || "")) return null; // rg missing (127/ENOENT) or unusable; code 1 = no matches
            const rows = [];
            (r.stdout || "").split("\n").forEach(l => {
                if (!l.trim()) return;
                const m = l.match(/^(.*?):(\d+):(.*)$/);
                if (!m) return;
                rows.push({ rule: "pattern", file: m[1].replace(/^\.\//, ""), line: +m[2], match: m[3].slice(0, 120) });
                if (rows.length >= 200) return;
            });
            return { rows, label: "ripgrep · " + c.split("/").pop() };
        };

        const scan = async () => {
            if (busy) return;
            busy = true;
            $("._sc_go").disabled = true;
            try {
                const c = cwd();
                if (!c) { $("._sc_out").innerHTML = `<div style="color:var(--text-dim)">No project folder (open one in the terminal).</div>`; $("._sc_src").textContent = "—"; return; }
                $("._sc_out").innerHTML = `<div style="color:var(--text-dim)">Scanning ${esc(c.split("/").pop())}…</div>`;
                let res = await runGitleaks(c);
                if (!alive) return;
                if (!res) res = await runRg(c);
                if (!alive) return;
                if (!res) { $("._sc_src").textContent = "—"; $("._sc_out").innerHTML = `<div style="color:var(--danger)">Neither gitleaks nor ripgrep (rg) is available.</div>`; return; }
                renderRows(res.rows, res.label);
            } catch (e) {
                if (alive) $("._sc_out").innerHTML = `<div style="color:var(--danger)">Error: ${esc(e && e.message)}</div>`;
            } finally {
                if (alive) $("._sc_go").disabled = false;
                busy = false;
            }
        };
        $("._sc_go").onclick = scan;

        return { destroy: () => { alive = false; } };
    }
};
