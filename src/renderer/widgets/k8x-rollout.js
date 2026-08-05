"use strict";
window.I18N.register({
    en: { "widget.k8x_rollout": "K8s Rollout", "cat.kubernetes": "Kubernetes" },
    ru: { "widget.k8x_rollout": "K8s раскатка", "cat.kubernetes": "Kubernetes" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.k8x_rollout = {
    id: "k8x_rollout",
    title: "widget.k8x_rollout",
    category: "kubernetes",
    description: "Rollout status of a chosen deployment",
    defaultSize: { w: 12, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                <input id="_kr_dep" placeholder="deployment name" style="flex:2;min-width:140px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
                <input id="_kr_ns" placeholder="namespace (default)" style="flex:1;min-width:100px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
                <button id="_kr_set" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 9px;cursor:pointer;font-size:11px">Check</button>
              </div>
              <div id="_kr_status" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-elevated)">
                <span id="_kr_dot" style="width:10px;height:10px;border-radius:50%;background:var(--text-dim);flex-shrink:0"></span>
                <span id="_kr_txt" style="font-family:var(--font-mono);font-size:12px">Enter a deployment and press Check.</span>
              </div>
              <span id="_kr_meta" style="color:var(--text-dim);font-size:11px"></span>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, dep = "", ns = "";
        // rollout status can block until complete; use --timeout to keep it snappy
        const kc = (args) => window.dyo.exec("kubectl", args, { cwd: window.term ? window.term.lastCwd : undefined, timeout: 9000 });

        const setDot = (color) => { $("#_kr_dot").style.background = color; };

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            dep = (s && s["k8x.rollout.dep"]) || "";
            ns = (s && s["k8x.rollout.ns"]) || "";
            $("#_kr_dep").value = dep;
            $("#_kr_ns").value = ns;
            if (dep) tick();
        });

        $("#_kr_set").onclick = async () => {
            dep = $("#_kr_dep").value.trim();
            ns = $("#_kr_ns").value.trim();
            await window.dyo.settings.set({ "k8x.rollout.dep": dep, "k8x.rollout.ns": ns });
            if (dep) { $("#_kr_txt").textContent = "checking…"; setDot("var(--accent)"); tick(); }
            else { $("#_kr_txt").textContent = "Enter a deployment and press Check."; setDot("var(--text-dim)"); }
        };

        const tick = async () => {
            if (!alive || busy || !dep) return;
            busy = true;
            try {
                const args = ["rollout", "status", "deployment/" + dep, "--timeout=5s"];
                if (ns) { args.push("-n", ns); }
                const r = await kc(args);
                if (!alive) return;
                const out = ((r && r.stdout) || "").trim();
                const err = ((r && r.stderr) || "").trim();
                if (!r || (r.code !== 0 && !out && !err)) {
                    $("#_kr_txt").textContent = "✗ kubectl not found — install to enable";
                    setDot("var(--danger)");
                    return;
                }
                const msg = (out || err).split("\n").pop();
                const done = /successfully rolled out/.test(out);
                const progressing = /waiting|Waiting|progress|out of/.test(out || err) && !done;
                if (done) { setDot("var(--accent2)"); }
                else if (r.code !== 0 && !progressing) { setDot("var(--danger)"); }
                else { setDot("var(--accent)"); }
                $("#_kr_txt").textContent = msg || "(no status)";
                $("#_kr_meta").textContent = (ns ? ns + "/" : "") + dep + " · " + new Date().toLocaleTimeString(window.I18N.locale());
            } catch (e) {
                if (alive) { $("#_kr_txt").textContent = "error: " + esc(e && e.message); setDot("var(--danger)"); }
            } finally { busy = false; }
        };

        const iv = setInterval(tick, 5000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
