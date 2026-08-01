"use strict";
window.I18N.register({
    en: { "widget.traceroute": "Traceroute", "cat.network": "Network" },
    ru: { "widget.traceroute": "Трассировка", "cat.network": "Сеть" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.traceroute = {
    id: "traceroute",
    title: "widget.traceroute",
    category: "network",
    description: "Trace the network path to a host",
    defaultSize: { w: 12, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
              <div style="display:flex;gap:6px;align-items:center">
                <input class="_tr_in" placeholder="host or IP (e.g. 1.1.1.1)" value="1.1.1.1" style="flex:1;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 8px;font-family:var(--font-mono)"/>
                <button class="_tr_go" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;cursor:pointer">Trace</button>
                <span class="_tr_meta" style="color:var(--text-dim)"></span>
              </div>
              <pre class="_tr_out" style="flex:1;overflow:auto;margin:0;font-family:var(--font-mono);font-size:11.5px;color:var(--text-dim);white-space:pre-wrap;word-break:break-all">Enter a host and press Trace. Max 15 hops · can take a few seconds.</pre>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;

        const run = async () => {
            if (busy) return;
            const host = $("._tr_in").value.trim();
            if (!host) return;
            busy = true;
            $("._tr_go").disabled = true;
            $("._tr_meta").textContent = "tracing…";
            $("._tr_out").textContent = `traceroute to ${host} (max 15 hops)…`;
            try {
                const r = await window.dyo.exec("traceroute", ["-m", "15", "-w", "2", host], { timeout: 15000 });
                if (!alive) return;
                if (!r || (r.code !== 0 && !(r.stdout || "").trim())) {
                    const msg = (r && r.stderr && r.stderr.trim()) || "traceroute not available or timed out";
                    $("._tr_out").innerHTML = `<span style="color:var(--danger)">${esc(msg)}</span>`;
                } else {
                    const out = (r.stdout || "").trim() || "(no output)";
                    $("._tr_out").textContent = out;
                }
            } catch (e) {
                if (alive) $("._tr_out").innerHTML = `<span style="color:var(--danger)">Error: ${esc(e && e.message)}</span>`;
            } finally {
                if (alive) { $("._tr_go").disabled = false; $("._tr_meta").textContent = ""; }
                busy = false;
            }
        };
        $("._tr_go").onclick = run;
        $("._tr_in").addEventListener("keydown", e => { if (e.key === "Enter") run(); });

        return { destroy: () => { alive = false; } };
    }
};
