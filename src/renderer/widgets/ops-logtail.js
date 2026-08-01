"use strict";
window.I18N.register({
    en: { "widget.logtail": "Log Tail", "cat.monitoring": "Monitoring" },
    ru: { "widget.logtail": "Хвост лога", "cat.monitoring": "Мониторинг" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.logtail = {
    id: "logtail",
    title: "widget.logtail",
    category: "monitoring",
    description: "Live tail of a file — last ~40 lines, auto-scroll",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                <input id="_lt_path" placeholder="/var/log/system.log" style="flex:1;min-width:180px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
                <button id="_lt_set" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 9px;cursor:pointer;font-size:11px">Set</button>
                <label style="display:flex;align-items:center;gap:4px;color:var(--text-dim);font-size:11px"><input type="checkbox" id="_lt_wrap"/>wrap</label>
                <span id="_lt_meta" style="color:var(--text-dim);font-size:11px"></span>
              </div>
              <pre id="_lt_pre" style="flex:1;margin:0;overflow:auto;background:var(--terminal-bg);border:1px solid var(--border);border-radius:6px;padding:8px;font-family:var(--font-mono);font-size:11px;line-height:1.4;white-space:pre;color:var(--text)"></pre>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, path = "";
        const pre = $("#_lt_pre");

        $("#_lt_wrap").onchange = () => { pre.style.whiteSpace = $("#_lt_wrap").checked ? "pre-wrap" : "pre"; };

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            path = (s && s["log.path"]) || "";
            $("#_lt_path").value = path;
            tick();
        });

        $("#_lt_set").onclick = async () => {
            path = $("#_lt_path").value.trim();
            await window.dyo.settings.set({ "log.path": path });
            pre.textContent = "";
            tick();
        };

        const render = (text) => {
            const atBottom = pre.scrollHeight - pre.scrollTop - pre.clientHeight < 30;
            const lines = String(text).replace(/\s+$/, "").split(/\r?\n/);
            const tail = lines.slice(-40).join("\n");
            pre.textContent = tail;
            if (atBottom) pre.scrollTop = pre.scrollHeight;
        };

        const tick = async () => {
            if (!alive || busy) return;
            if (!path) { pre.textContent = "Set a file path to tail."; $("#_lt_meta").textContent = ""; return; }
            busy = true;
            try {
                const st = await window.dyo.fs.stat(path).catch(() => null);
                if (st && st.error) { pre.textContent = "✗ " + st.error; $("#_lt_meta").textContent = ""; busy = false; return; }
                if (st && st.dir) { pre.textContent = "✗ path is a directory"; busy = false; return; }
                const big = st && st.size && st.size > 480000;
                if (big) {
                    // Use tail for large files
                    const r = await window.dyo.exec("tail", ["-n", "200", path], { timeout: 8000 }).catch(() => null);
                    if (!alive) return;
                    if (!r || r.code !== 0) { pre.textContent = "✗ tail failed" + (r && r.stderr ? ": " + r.stderr : ""); busy = false; return; }
                    render(r.stdout);
                    $("#_lt_meta").textContent = "large file · tail -200 · " + (st.size / 1048576).toFixed(1) + "MB · " + new Date().toLocaleTimeString();
                } else {
                    const r = await window.dyo.fs.read(path, 500000).catch(() => null);
                    if (!alive) return;
                    if (!r || r.error) { pre.textContent = "✗ " + ((r && r.error) || "read failed"); busy = false; return; }
                    render(r.content || "");
                    $("#_lt_meta").textContent = ((r.size || 0) / 1024).toFixed(0) + "KB · " + new Date().toLocaleTimeString();
                }
            } catch (e) {
                if (alive) pre.textContent = "Error: " + (e && e.message);
            } finally { busy = false; }
        };

        const iv = setInterval(tick, 2000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
