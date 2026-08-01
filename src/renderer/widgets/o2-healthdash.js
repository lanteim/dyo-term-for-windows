"use strict";
window.I18N.register({
    en: { "widget.o2_healthdash": "Health Dashboard", "cat.observability": "Observability" },
    ru: { "widget.o2_healthdash": "Панель здоровья", "cat.observability": "Наблюдаемость" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.o2_healthdash = {
    id: "o2_healthdash",
    title: "widget.o2_healthdash",
    category: "observability",
    description: "Multi-service health board: pings a list of endpoints, green/red per service",
    defaultSize: { w: 9, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px;width:100%;box-sizing:border-box";
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div id="_c" style="display:none;flex-direction:column;gap:6px;height:100%">
              <div style="color:var(--text-dim);font-size:11px">One service per line: <b>Name = http://url</b></div>
              <textarea id="_ta" placeholder="api = https://api.example.com/health&#10;grafana = http://localhost:3000/api/health&#10;prometheus = http://localhost:9090/-/healthy" style="${inp};flex:1;min-height:80px;resize:none;font-size:11px"></textarea>
              <button id="_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px">Save</button>
            </div>
            <div id="_m" style="display:none;flex-direction:column;gap:6px;height:100%">
              <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">
                <span style="color:#3fb950">UP <b id="_up" style="font-size:16px">0</b></span>
                <span style="color:var(--danger)">DOWN <b id="_dn" style="font-size:16px">0</b></span>
                <span style="color:var(--text-dim)">of <b id="_tot">0</b></span>
              </div>
              <div id="_grid" style="flex:1;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;align-content:start"></div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span id="_meta" style="color:var(--text-dim);font-size:11px"></span>
                <button id="_edit" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">⚙</button>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, svc = [];
        const showCfg = show => { $("#_c").style.display = show ? "flex" : "none"; $("#_m").style.display = show ? "none" : "flex"; };
        const parse = txt => (txt || "").split("\n").map(l => l.trim()).filter(Boolean).map(l => {
            const i = l.indexOf("=");
            if (i < 0) return { name: l, url: l };
            return { name: l.slice(0, i).trim() || l.slice(i + 1).trim(), url: l.slice(i + 1).trim() };
        }).filter(x => x.url);

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            const raw = (s && s["o2.healthdash.list"]) || "";
            $("#_ta").value = raw;
            svc = parse(raw);
            if (!svc.length) showCfg(true); else { showCfg(false); render(); tick(); }
        });
        $("#_save").onclick = async () => {
            const raw = $("#_ta").value;
            await window.dyo.settings.set({ "o2.healthdash.list": raw });
            svc = parse(raw);
            if (svc.length) { showCfg(false); render(); tick(); } else showCfg(true);
        };
        $("#_edit").onclick = () => showCfg(true);

        const render = () => {
            $("#_tot").textContent = svc.length;
            $("#_grid").innerHTML = svc.map((s, i) => `
              <div id="_card${i}" style="border:1px solid var(--border);border-radius:6px;padding:6px 8px;display:flex;align-items:center;gap:8px;background:var(--bg-elevated)">
                <span class="_d" style="font-size:16px;color:var(--text-dim)">●</span>
                <div style="overflow:hidden">
                  <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.name)}</div>
                  <div class="_s" style="color:var(--text-dim);font-size:10px">…</div>
                </div>
              </div>`).join("");
        };

        const ping = async (s) => {
            const t0 = Date.now();
            try {
                const r = await window.dyo.http(s.url, { headers: { Accept: "*/*" }, timeout: 6000 });
                const ms = Date.now() - t0;
                if (!r || r.error) return { ok: false, txt: (r && r.error) || "error" };
                return { ok: !!r.ok, txt: "HTTP " + r.status + " · " + ms + "ms" };
            } catch (e) { return { ok: false, txt: (e && e.message) || "error" }; }
        };

        const tick = async () => {
            if (!alive || busy || !svc.length) return;
            busy = true; $("#_meta").textContent = "pinging…";
            try {
                const results = await Promise.all(svc.map(ping));
                if (!alive) return;
                let up = 0, dn = 0;
                results.forEach((res, i) => {
                    const card = $("#_card" + i); if (!card) return;
                    const dot = card.querySelector("._d"), sub = card.querySelector("._s");
                    if (res.ok) { up++; dot.style.color = "#3fb950"; } else { dn++; dot.style.color = "var(--danger)"; }
                    sub.textContent = res.txt;
                });
                $("#_up").textContent = up; $("#_dn").textContent = dn;
                $("#_meta").textContent = "updated " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) $("#_meta").textContent = "error";
            } finally { busy = false; }
        };
        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
