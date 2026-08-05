"use strict";
window.I18N.register({
    en: { "widget.de_rabbitmq": "RabbitMQ Queues", "cat.data": "Data" },
    ru: { "widget.de_rabbitmq": "Очереди RabbitMQ", "cat.data": "Данные" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.de_rabbitmq = {
    id: "de_rabbitmq",
    title: "widget.de_rabbitmq",
    category: "data",
    description: "RabbitMQ queue depths via the management API",
    defaultSize: { w: 9, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div id="_rq_cfg" style="display:none;flex-direction:column;gap:6px">
              <input id="_rq_url" placeholder="http://localhost:15672" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
              <div style="display:flex;gap:6px">
                <input id="_rq_user" placeholder="guest" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px;flex:1"/>
                <input id="_rq_pass" type="password" placeholder="guest" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px;flex:1"/>
              </div>
              <button id="_rq_save" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px">Save</button>
            </div>
            <div id="_rq_main" style="display:none;flex-direction:column;gap:6px;height:100%">
              <div style="display:flex;gap:14px">
                <div class="metric-row"><span class="k">QUEUES</span><span class="v"><b id="_rq_cnt" style="font-size:16px;color:var(--accent2)">—</b></span></div>
                <div class="metric-row"><span class="k">READY</span><span class="v"><b id="_rq_ready" style="font-size:16px">—</b></span></div>
              </div>
              <div id="_rq_list" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;font-family:var(--font-mono);font-size:11px"></div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span id="_rq_meta" style="color:var(--text-dim);font-size:11px"></span>
                <button id="_rq_edit" title="Edit connection" aria-label="Edit connection" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">⚙</button>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, url = "", user = "guest", pass = "guest";
        const base = () => url.replace(/\/+$/, "");
        const showCfg = show => { $("#_rq_cfg").style.display = show ? "flex" : "none"; $("#_rq_main").style.display = show ? "none" : "flex"; };

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            url = (s && s["de.rabbitmq.url"]) || "";
            user = (s && s["de.rabbitmq.user"]) || "guest";
            pass = (s && s["de.rabbitmq.pass"]) || "guest";
            $("#_rq_url").value = url; $("#_rq_user").value = user; $("#_rq_pass").value = pass;
            if (!url) showCfg(true); else { showCfg(false); tick(); }
        });

        $("#_rq_save").onclick = async () => {
            url = $("#_rq_url").value.trim(); user = $("#_rq_user").value.trim(); pass = $("#_rq_pass").value;
            await window.dyo.settings.set({ "de.rabbitmq.url": url, "de.rabbitmq.user": user, "de.rabbitmq.pass": pass });
            if (url) { showCfg(false); tick(); }
        };
        $("#_rq_edit").onclick = () => showCfg(true);

        const tick = async () => {
            if (!alive || busy || !url) return;
            busy = true;
            $("#_rq_meta").textContent = "polling…";
            try {
                const headers = { Accept: "application/json", Authorization: "Basic " + btoa(user + ":" + pass) };
                const r = await window.dyo.http(base() + "/api/queues?page=1&page_size=200&disable_stats=false", { headers, timeout: 8000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_rq_cnt").textContent = "—"; $("#_rq_ready").textContent = "—";
                    $("#_rq_list").innerHTML = `<div style="padding:8px;color:var(--danger)">${esc((r && r.error) || ("HTTP " + (r && r.status)))}</div>`;
                    $("#_rq_meta").textContent = "unavailable";
                    return;
                }
                let j; try { j = JSON.parse(r.text); } catch (e) { j = null; }
                const qs = Array.isArray(j) ? j : (j && Array.isArray(j.items) ? j.items : null);
                if (!qs) { $("#_rq_list").innerHTML = `<div style="padding:8px;color:var(--danger)">unexpected response</div>`; busy = false; return; }
                let totalReady = 0;
                qs.forEach(q => { totalReady += (q.messages_ready || 0); });
                $("#_rq_cnt").textContent = String(qs.length);
                $("#_rq_ready").textContent = String(totalReady);
                const sorted = qs.slice().sort((a, b) => (b.messages || 0) - (a.messages || 0));
                if (!qs.length) $("#_rq_list").innerHTML = `<div style="padding:8px;color:var(--text-dim)">No queues.</div>`;
                else $("#_rq_list").innerHTML = sorted.slice(0, 200).map(q => {
                    const total = q.messages || 0;
                    const unack = q.messages_unacknowledged || 0;
                    const col = total > 0 ? "var(--accent2)" : "var(--text-dim)";
                    return `<div style="display:flex;gap:8px;padding:3px 8px;border-bottom:1px solid var(--border);white-space:nowrap"><span style="flex:1;overflow:hidden;text-overflow:ellipsis">${esc(q.name)}</span><span style="color:${col};width:60px;text-align:right">${total}</span><span style="color:var(--text-dim);width:70px;text-align:right">${unack} un</span></div>`;
                }).join("");
                $("#_rq_meta").textContent = "updated " + new Date().toLocaleTimeString(window.I18N.locale());
            } catch (e) {
                if (alive) $("#_rq_list").innerHTML = `<div style="padding:8px;color:var(--danger)">${esc(e && e.message)}</div>`;
            } finally { busy = false; }
        };

        const iv = setInterval(tick, 6000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
