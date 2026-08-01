"use strict";
window.I18N.register({
    en: { "widget.dkx_diskusage": "Docker Disk Usage", "cat.docker": "Docker" },
    ru: { "widget.dkx_diskusage": "Docker диск", "cat.docker": "Docker" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.dkx_diskusage = {
        id: "dkx_diskusage",
        title: "widget.dkx_diskusage",
        category: "docker",
        description: "Detailed docker disk usage summary",
        defaultSize: { w: 12, h: 4 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🐳 DISK USAGE (df -v)</span>
                    <span id="_dkd_msg" style="color:var(--text-dim);margin-left:auto"></span>
                  </div>
                  <div id="_dkd_body" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:6px"></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, busy = false;

            const section = (title, headers, rows) => {
                let html = `<div style="margin-bottom:8px"><div style="color:var(--accent);font-weight:600;margin:2px 0 4px">${esc(title)}</div>`;
                if (!rows.length) { return html + `<div style="color:var(--text-dim);font-size:11px">none</div></div>`; }
                html += `<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11px"><thead><tr style="text-align:left;color:var(--text-dim)">`;
                headers.forEach(h => html += `<th style="padding:2px 6px">${esc(h)}</th>`);
                html += `</tr></thead><tbody>`;
                rows.slice(0, 200).forEach(cells => {
                    html += `<tr style="border-top:1px solid var(--border)">`;
                    cells.forEach((c, i) => html += `<td style="padding:2px 6px;color:${i === 0 ? "var(--text)" : "var(--text-dim)"};max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c)}</td>`);
                    html += `</tr>`;
                });
                return html + `</tbody></table></div>`;
            };

            const parseJson = (out) => out.split("\n").filter(l => l.trim()).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);

            const tick = async () => {
                if (!alive || busy) return;
                busy = true;
                try {
                    const res = await window.dyo.exec("docker", ["system", "df", "-v", "--format", "json"], { timeout: 10000 });
                    if (!res || res.code !== 0) {
                        const err = (res && (res.stderr || "")).toLowerCase();
                        let msg = "docker not available";
                        if (err.includes("cannot connect") || err.includes("daemon")) msg = "daemon not running";
                        else if (err.includes("not found") || (res && res.code === 127)) msg = "docker not found";
                        $("#_dkd_msg").textContent = msg;
                        $("#_dkd_body").innerHTML = `<div style="color:var(--text-dim)">${esc(msg)}</div>`;
                        return;
                    }
                    $("#_dkd_msg").textContent = "";
                    const objs = parseJson(res.stdout || "");
                    // docker system df -v --format json emits one object with arrays (newer) OR per-line objects (older).
                    let images = [], containers = [], volumes = [];
                    objs.forEach(o => {
                        if (Array.isArray(o.Images)) images = images.concat(o.Images);
                        if (Array.isArray(o.Containers)) containers = containers.concat(o.Containers);
                        if (Array.isArray(o.Volumes)) volumes = volumes.concat(o.Volumes);
                        // older per-type lines
                        if (o.Type === "Images" || o.Repository) images.push(o);
                        if (o.Type === "Containers") containers.push(o);
                        if (o.Type === "Local Volumes" || (o.Name && o.Links !== undefined)) volumes.push(o);
                    });

                    let html = "";
                    html += section("Images", ["REPO:TAG", "SIZE", "SHARED"],
                        images.map(i => [`${i.Repository || i.repository || "?"}:${i.Tag || i.tag || ""}`, i.Size || i.VirtualSize || "", i.SharedSize || ""]));
                    html += section("Containers", ["NAME", "IMAGE", "SIZE", "STATUS"],
                        containers.map(c => [c.Names || c.Name || "", c.Image || "", c.Size || "", c.Status || ""]));
                    html += section("Volumes", ["NAME", "LINKS", "SIZE"],
                        volumes.map(v => [v.Name || "", String(v.Links == null ? "" : v.Links), v.Size || ""]));

                    if (!images.length && !containers.length && !volumes.length) {
                        // fallback to plain text
                        const res2 = await window.dyo.exec("docker", ["system", "df", "-v"], { timeout: 10000 });
                        if (res2 && res2.code === 0 && (res2.stdout || "").trim()) {
                            $("#_dkd_body").innerHTML = `<pre style="margin:0;font-family:var(--font-mono);font-size:11px;white-space:pre-wrap;color:var(--text)">${esc(res2.stdout.trim())}</pre>`;
                        } else {
                            $("#_dkd_body").innerHTML = `<div style="color:var(--text-dim)">No usage data.</div>`;
                        }
                        return;
                    }
                    $("#_dkd_body").innerHTML = html;
                } catch (e) { $("#_dkd_msg").textContent = "error"; } finally { busy = false; }
            };
            tick();
            const iv = setInterval(tick, 6000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
