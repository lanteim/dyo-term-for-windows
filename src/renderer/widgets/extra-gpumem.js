"use strict";
window.I18N.register({
    en: { "widget.extra_gpumem": "GPU Memory", "cat.data": "Data" },
    ru: { "widget.extra_gpumem": "Память GPU", "cat.data": "Данные" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.extra_gpumem = {
    id: "extra_gpumem",
    title: "widget.extra_gpumem",
    category: "data",
    description: "GPU memory usage (systeminformation / nvidia-smi)",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        let alive = true, busy = false;

        body.innerHTML = `<div class="_c" style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px;overflow:auto"></div>`;
        const c = body.querySelector("._c");
        const mb = v => (v >= 1024 ? (v / 1024).toFixed(1) + " GB" : Math.round(v) + " MB");

        const renderCards = cards => {
            if (!cards.length) { c.innerHTML = `<div style="color:var(--text-dim);padding:8px">No GPU info available on this system.</div>`; return; }
            c.innerHTML = cards.map(g => {
                const has = typeof g.total === "number" && g.total > 0;
                const pct = has && typeof g.used === "number" ? Math.min(100, Math.round(g.used / g.total * 100)) : null;
                return `<div style="border:1px solid var(--border);border-radius:6px;padding:8px">
                    <div style="font-weight:600;color:var(--accent)">${esc(g.model || "GPU")}</div>
                    ${g.vendor ? `<div style="color:var(--text-dim);font-size:11px">${esc(g.vendor)}${g.shared ? " · shared memory" : ""}</div>` : ""}
                    ${has ? `<div class="metric-row" style="margin-top:6px"><span class="k">VRAM</span><span class="v">${g.used != null ? mb(g.used) + " / " : ""}${mb(g.total)}${pct != null ? " (" + pct + "%)" : ""}</span></div>
                    ${pct != null ? `<div class="bar"><i style="width:${pct}%"></i></div>` : ""}` : `<div style="color:var(--text-dim);font-size:11px;margin-top:6px">Memory total not reported.</div>`}
                </div>`;
            }).join("");
        };

        const viaNvidia = async () => {
            const r = await window.dyo.exec("nvidia-smi", ["--query-gpu=name,memory.used,memory.total", "--format=csv,noheader,nounits"], { timeout: 6000 });
            if (!r || r.code !== 0 || !r.stdout || !r.stdout.trim()) return null;
            return r.stdout.trim().split("\n").map(l => {
                const p = l.split(",").map(x => x.trim());
                return { model: p[0], vendor: "NVIDIA", used: parseFloat(p[1]), total: parseFloat(p[2]) };
            });
        };

        const tick = async () => {
            if (busy || !alive) return;
            busy = true;
            try {
                const nv = await viaNvidia();
                if (!alive) return;
                if (nv && nv.length) { renderCards(nv); return; }
                const g = await window.dyo.si("graphics");
                if (!alive) return;
                const controllers = (g && g.controllers) || [];
                const cards = controllers.map(ct => {
                    const vendor = ct.vendor || "";
                    const apple = /apple/i.test(vendor) || /apple/i.test(ct.model || "");
                    return {
                        model: ct.model || "GPU",
                        vendor,
                        shared: apple,
                        used: typeof ct.memoryUsed === "number" ? ct.memoryUsed : null,
                        total: typeof ct.memoryTotal === "number" ? ct.memoryTotal : (typeof ct.vram === "number" ? ct.vram : null)
                    };
                });
                renderCards(cards);
            } catch (e) {
                if (alive) c.innerHTML = `<div style="color:var(--danger);padding:8px">${esc(String(e.message || e))}</div>`;
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 4000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
