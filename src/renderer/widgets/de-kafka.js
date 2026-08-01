"use strict";
window.I18N.register({
    en: { "widget.de_kafka": "Kafka Topics", "cat.data": "Data" },
    ru: { "widget.de_kafka": "Топики Kafka", "cat.data": "Данные" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.de_kafka = {
    id: "de_kafka",
    title: "widget.de_kafka",
    category: "data",
    description: "List Kafka topics via kafka-topics CLI",
    defaultSize: { w: 8, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const SKEY = "de.kafka.bootstrap";
        let alive = true, busy = false, bootstrap = "localhost:9092";

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <span style="color:var(--accent);font-weight:600">kafka</span>
              <input id="_kf_bs" placeholder="localhost:9092" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px;width:150px"/>
              <button id="_kf_save" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 10px;cursor:pointer;font-family:var(--font-mono)">Save</button>
              <span id="_kf_st" style="color:var(--text-dim);margin-left:auto"></span>
            </div>
            <div class="metric-row"><span class="k">TOPICS</span><span class="v"><b id="_kf_cnt" style="font-size:16px;color:var(--accent2)">—</b></span></div>
            <div id="_kf_msg" style="color:var(--text-dim);font-size:11px"></div>
            <div id="_kf_list" style="flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;font-family:var(--font-mono);font-size:11.5px"></div>
          </div>`;
        const $ = s => body.querySelector(s);

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            if (s && s[SKEY]) bootstrap = s[SKEY];
            $("#_kf_bs").value = bootstrap;
            tick();
        });

        $("#_kf_save").onclick = async () => {
            bootstrap = $("#_kf_bs").value.trim() || "localhost:9092";
            await window.dyo.settings.set({ [SKEY]: bootstrap });
            tick();
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            $("#_kf_st").textContent = "polling…";
            try {
                const r = await window.dyo.exec("kafka-topics", ["--bootstrap-server", bootstrap, "--list"], { cwd: window.term ? window.term.lastCwd : undefined, timeout: 15000 });
                if (!alive) return;
                if (!r || r.code !== 0) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n")[0] : "kafka-topics not found";
                    $("#_kf_cnt").textContent = "—";
                    $("#_kf_list").innerHTML = "";
                    $("#_kf_msg").innerHTML = `<span style="color:var(--danger)">${esc(err)}</span> — install Kafka CLI or check the broker.`;
                    $("#_kf_st").textContent = "unavailable";
                    return;
                }
                const topics = r.stdout.split("\n").map(l => l.trim()).filter(Boolean);
                $("#_kf_msg").textContent = "";
                $("#_kf_cnt").textContent = String(topics.length);
                if (!topics.length) {
                    $("#_kf_list").innerHTML = `<div style="padding:10px;color:var(--text-dim)">No topics.</div>`;
                } else {
                    $("#_kf_list").innerHTML = topics.slice(0, 200).map(t =>
                        `<div style="padding:3px 8px;border-bottom:1px solid var(--border);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">▸ ${esc(t)}</div>`
                    ).join("");
                }
                $("#_kf_st").textContent = "updated " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) $("#_kf_msg").innerHTML = `<span style="color:var(--danger)">error: ${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };

        const iv = setInterval(tick, 20000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
