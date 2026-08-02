"use strict";
window.I18N.register({
    en: { "widget.k8x_portforward": "K8s Port-Forward", "cat.kubernetes": "Kubernetes" },
    ru: { "widget.k8x_portforward": "K8s проброс портов", "cat.kubernetes": "Kubernetes" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.k8x_portforward = {
    id: "k8x_portforward",
    title: "widget.k8x_portforward",
    category: "kubernetes",
    description: "Saved kubectl port-forward shortcuts, launched in a terminal",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const KEY = "k8x.portforwards";
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                <input id="_pf_ns" placeholder="namespace" style="width:110px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
                <input id="_pf_res" placeholder="svc/my-service" style="flex:1;min-width:120px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
                <input id="_pf_ports" placeholder="8080:80" style="width:110px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:11.5px"/>
                <button id="_pf_add" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:11px;font-weight:600">Add</button>
              </div>
              <div id="_pf_hint" style="color:var(--text-dim);font-size:11px">Start runs in the focused terminal — keep that tab open to hold the tunnel.</div>
              <div id="_pf_list" style="overflow:auto;flex:1;display:flex;flex-direction:column;gap:5px"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, forwards = [];

        const shq = s => "'" + String(s).replace(/'/g, "'\\''") + "'";
        const cmdFor = (f) => {
            const parts = ["kubectl", "port-forward"];
            if (f.ns) parts.push("-n", shq(f.ns));
            parts.push(shq(f.resource), shq(f.ports));
            return parts.join(" ");
        };

        const render = () => {
            const list = $("#_pf_list");
            if (!forwards.length) {
                list.innerHTML = `<div style="color:var(--text-dim);font-size:11px;padding:6px">No saved port-forwards yet. Add one above.</div>`;
                return;
            }
            list.innerHTML = forwards.map((f, i) => `
                <div style="display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:6px;padding:6px 8px;background:var(--bg-elevated)">
                  <div style="flex:1;min-width:0">
                    <div style="font-family:var(--font-mono);font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.resource)} <span style="color:var(--accent2)">${esc(f.ports)}</span></div>
                    <div style="color:var(--text-dim);font-size:10.5px">ns: ${esc(f.ns || "default")}</div>
                  </div>
                  <button data-act="start" data-i="${i}" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:5px;padding:4px 9px;cursor:pointer;font-size:11px;font-weight:600">Start</button>
                  <button data-act="del" data-i="${i}" title="remove" style="background:transparent;color:var(--danger);border:1px solid var(--border);border-radius:5px;padding:4px 8px;cursor:pointer;font-size:11px">✕</button>
                </div>`).join("");
        };

        const save = () => window.dyo.settings.set({ [KEY]: forwards });

        body.addEventListener("click", (e) => {
            const btn = e.target.closest("button[data-act]");
            if (!btn) return;
            const i = parseInt(btn.getAttribute("data-i"), 10);
            const act = btn.getAttribute("data-act");
            if (act === "del") {
                forwards.splice(i, 1);
                save(); render();
            } else if (act === "start") {
                const f = forwards[i];
                if (!f) return;
                if (window.term && typeof window.term.runInFocused === "function") {
                    window.term.runInFocused(cmdFor(f) + "\n");
                    $("#_pf_hint").textContent = "Started " + f.resource + " " + f.ports + " in the focused terminal.";
                } else {
                    $("#_pf_hint").textContent = "No focused terminal available to run the command.";
                }
            }
        });

        $("#_pf_add").onclick = () => {
            const ns = $("#_pf_ns").value.trim();
            const resource = $("#_pf_res").value.trim();
            const ports = $("#_pf_ports").value.trim();
            if (!resource || !ports) {
                $("#_pf_hint").textContent = "Resource and ports are required (e.g. svc/api and 8080:80).";
                return;
            }
            if (ns && !/^[A-Za-z0-9_.\/-]+$/.test(ns)) {
                $("#_pf_hint").textContent = "Invalid namespace — use letters, digits and . _ / - only.";
                return;
            }
            if (!/^[A-Za-z0-9_.\/-]+$/.test(resource)) {
                $("#_pf_hint").textContent = "Invalid resource — use letters, digits and . _ / - only (e.g. svc/api).";
                return;
            }
            if (!/^\d+(:\d+)?$/.test(ports)) {
                $("#_pf_hint").textContent = "Invalid ports — use 8080 or 8080:80.";
                return;
            }
            forwards.push({ ns, resource, ports });
            $("#_pf_ns").value = ""; $("#_pf_res").value = ""; $("#_pf_ports").value = "";
            $("#_pf_hint").textContent = "Saved. Press Start to launch it in the focused terminal.";
            save(); render();
        };

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            const v = s && s[KEY];
            forwards = Array.isArray(v) ? v.filter(x => x && x.resource && x.ports) : [];
            render();
        });

        return { destroy: () => { alive = false; } };
    }
};
