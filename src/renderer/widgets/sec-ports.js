"use strict";
window.I18N.register({
    en: { "widget.sec_ports": "Risky Ports", "cat.security": "Security" },
    ru: { "widget.sec_ports": "Опасные порты", "cat.security": "Безопасность" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.sec_ports = {
    id: "sec_ports",
    title: "widget.sec_ports",
    category: "security",
    description: "Local listening ports, flagging risky/exposed services",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="color:var(--text-dim)">Listening TCP</span>
                <span class="_sp_meta" style="color:var(--text-dim);margin-left:auto">…</span>
              </div>
              <div class="_sp_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;

        // port -> {name, risk}
        const RISKY = {
            "21": ["FTP", "cleartext"], "23": ["Telnet", "cleartext"], "25": ["SMTP", "mail relay"],
            "111": ["rpcbind", "info leak"], "135": ["MS RPC", "exposed"], "139": ["NetBIOS", "exposed"],
            "445": ["SMB", "exposed"], "512": ["rexec", "legacy"], "513": ["rlogin", "legacy"], "514": ["rsh/syslog", "legacy"],
            "1433": ["MSSQL", "db exposed"], "1521": ["Oracle", "db exposed"], "2049": ["NFS", "exposed"],
            "3306": ["MySQL", "db exposed"], "3389": ["RDP", "remote desktop"], "5432": ["PostgreSQL", "db exposed"],
            "5900": ["VNC", "remote desktop"], "5901": ["VNC", "remote desktop"], "6379": ["Redis", "often no auth"],
            "9200": ["Elasticsearch", "often no auth"], "9300": ["Elasticsearch", "cluster"],
            "11211": ["Memcached", "no auth"], "27017": ["MongoDB", "often no auth"], "27018": ["MongoDB", "often no auth"],
            "2375": ["Docker API", "root access"], "8020": ["Hadoop", "exposed"], "50070": ["Hadoop", "exposed"]
        };
        const isPublic = (host) => host === "*" || host === "0.0.0.0" || host === "[::]" || host === "::" || (host && host.startsWith("[::]"));

        const parse = (out) => {
            const lines = out.split("\n").filter(l => l.trim());
            const seen = new Set(), res = [];
            for (let i = 1; i < lines.length; i++) {
                const p = lines[i].trim().split(/\s+/);
                if (p.length < 9) continue;
                const cmd = p[0], pid = p[1];
                const name = p.slice(8).join(" ").replace(/\s*\(LISTEN\)\s*$/, "");
                const addr = name.split(/\s+/)[0];
                const pm = addr.match(/:(\d+|\*)$/);
                const port = pm ? pm[1] : addr;
                const host = pm ? addr.slice(0, addr.length - pm[0].length) : "";
                const key = port + "|" + host + "|" + cmd + "|" + pid;
                if (seen.has(key)) continue;
                seen.add(key);
                res.push({ port, host, cmd, pid });
                if (res.length >= 200) break;
            }
            res.sort((a, b) => (parseInt(a.port) || 1e9) - (parseInt(b.port) || 1e9));
            return res;
        };

        const render = (rows) => {
            const risky = rows.filter(r => RISKY[r.port]).length;
            $("._sp_meta").innerHTML = `${rows.length} port${rows.length === 1 ? "" : "s"}` + (risky ? ` · <span style="color:var(--danger)">${risky} risky</span>` : "");
            if (!rows.length) { $("._sp_body").innerHTML = `<div style="padding:10px;color:var(--text-dim)">No listening ports (or lsof unavailable).</div>`; return; }
            let html = `<table style="border-collapse:collapse;width:100%;font-family:var(--font-mono);font-size:11.5px"><thead><tr>`;
            ["PORT", "SERVICE / NOTE", "PROC", "BIND"].forEach(h => html += `<th style="position:sticky;top:0;background:var(--bg-elevated);text-align:left;padding:5px 8px;border-bottom:1px solid var(--border);color:var(--accent)">${h}</th>`);
            html += `</tr></thead><tbody>`;
            rows.forEach(r => {
                const risk = RISKY[r.port];
                const pub = isPublic(r.host);
                const flagged = !!risk;
                const portCol = flagged ? "var(--danger)" : "var(--accent2)";
                let svc = "";
                if (risk) svc = `<span style="color:var(--danger)">${esc(risk[0])}</span> <span style="color:var(--text-dim)">— ${esc(risk[1])}${pub ? ", public bind" : ""}</span>`;
                else svc = `<span style="color:var(--text-dim)">${pub ? "public bind" : "local"}</span>`;
                html += `<tr>
                    <td style="padding:4px 8px;border-bottom:1px solid var(--border);color:${portCol};font-weight:600">${flagged ? "⚠ " : ""}${esc(r.port)}</td>
                    <td style="padding:4px 8px;border-bottom:1px solid var(--border)">${svc}</td>
                    <td style="padding:4px 8px;border-bottom:1px solid var(--border);white-space:nowrap">${esc(r.cmd)}</td>
                    <td style="padding:4px 8px;border-bottom:1px solid var(--border);color:${pub ? "var(--accent2)" : "var(--text-dim)"}">${esc(r.host || "*")}</td>
                </tr>`;
            });
            html += `</tbody></table>`;
            $("._sp_body").innerHTML = html;
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const r = await window.dyo.exec("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN"], { timeout: 8000 });
                if (!alive) return;
                if (!r || (r.code !== 0 && !(r.stdout || "").trim())) {
                    $("._sp_body").innerHTML = `<div style="padding:10px;color:var(--danger)">lsof failed${r && r.stderr ? ": " + esc(r.stderr.trim().split("\n")[0]) : " or not available"}.</div>`;
                } else {
                    render(parse(r.stdout || ""));
                }
            } catch (e) {
                if (alive) $("._sp_body").innerHTML = `<div style="padding:10px;color:var(--danger)">Error: ${esc(e && e.message)}</div>`;
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
