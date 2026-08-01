"use strict";
window.I18N.register({
    en: { "widget.k8x_logs": "K8s Pod Logs", "cat.kubernetes": "Kubernetes" },
    ru: { "widget.k8x_logs": "K8s логи пода", "cat.kubernetes": "Kubernetes" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.k8x_logs = {
    id: "k8x_logs",
    title: "widget.k8x_logs",
    category: "kubernetes",
    description: "Tail the last ~40 log lines of a chosen pod",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                <input id="_kl_pod" placeholder="pod name" style="flex:2;min-width:140px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
                <input id="_kl_ns" placeholder="namespace (default)" style="flex:1;min-width:100px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
                <button id="_kl_set" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 9px;cursor:pointer;font-size:11px">Load</button>
                <span id="_kl_meta" style="color:var(--text-dim);font-size:11px"></span>
              </div>
              <pre id="_kl_pre" style="flex:1;margin:0;overflow:auto;background:var(--terminal-bg);border:1px solid var(--border);border-radius:6px;padding:8px;font-family:var(--font-mono);font-size:11px;line-height:1.4;white-space:pre-wrap;color:var(--text)"></pre>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, pod = "", ns = "";
        const pre = $("#_kl_pre");
        const kc = (args) => window.dyo.exec("kubectl", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 9000 });

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            pod = (s && s["k8x.pod"]) || "";
            ns = (s && s["k8x.ns"]) || "";
            $("#_kl_pod").value = pod;
            $("#_kl_ns").value = ns;
            if (pod) tick(); else pre.textContent = "Enter a pod name and press Load.";
        });

        $("#_kl_set").onclick = async () => {
            pod = $("#_kl_pod").value.trim();
            ns = $("#_kl_ns").value.trim();
            await window.dyo.settings.set({ "k8x.pod": pod, "k8x.ns": ns });
            pre.textContent = pod ? "loading…" : "Enter a pod name and press Load.";
            if (pod) tick();
        };

        const tick = async () => {
            if (!alive || busy || !pod) return;
            busy = true;
            try {
                const args = ["logs", "--tail=40", pod];
                if (ns) { args.push("-n", ns); }
                const r = await kc(args);
                if (!alive) return;
                if (!r || r.code !== 0) {
                    const err = r && r.stderr ? r.stderr.trim().split("\n")[0] : "kubectl not found — install to enable";
                    pre.textContent = "✗ " + err;
                    $("#_kl_meta").textContent = "";
                    return;
                }
                const atBottom = pre.scrollHeight - pre.scrollTop - pre.clientHeight < 30;
                pre.textContent = (r.stdout || "").replace(/\s+$/, "") || "(no output)";
                if (atBottom) pre.scrollTop = pre.scrollHeight;
                $("#_kl_meta").textContent = (ns ? ns + "/" : "") + pod + " · " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) pre.textContent = "error: " + esc(e && e.message);
            } finally { busy = false; }
        };

        const iv = setInterval(tick, 4000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
