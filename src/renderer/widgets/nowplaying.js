"use strict";
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS.nowplaying = {
    id: "nowplaying",
    title: "widget.nowplaying",
    category: "media",
    description: "Control Apple Music",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        body.innerHTML = `
            <div class="np-title" id="_np_t">—</div>
            <div class="np-artist" id="_np_a"></div>
            <div class="bar" style="margin-top:12px"><i id="_np_bar"></i></div>
            <div class="np-controls">
                <button data-a="previous">${window.ICONS.prev}</button>
                <button data-a="playpause" id="_np_pp">${window.ICONS.play}</button>
                <button data-a="next">${window.ICONS.next}</button>
                <span id="_np_state" style="margin-left:auto;color:var(--text-dim);font-size:11px"></span>
            </div>`;
        const $ = id => body.querySelector(id);
        let alive = true;
        body.querySelectorAll("button[data-a]").forEach(b =>
            b.onclick = async () => { await window.dyo.music.control(b.dataset.a); tick(); });

        const tick = async () => {
            if (!alive) return;
            const out = await window.dyo.music.state();
            if (!out || out === "notrunning") {
                $("#_np_t").textContent = window.I18N.t("np.notrunning");
                $("#_np_a").textContent = "";
                $("#_np_state").textContent = "";
                $("#_np_bar").style.width = "0%";
                $("#_np_pp").innerHTML = window.ICONS.play;
                return;
            }
            const p = out.split("\t");
            const state = p[0];
            if (state !== "playing" && state !== "paused") {
                $("#_np_t").textContent = window.I18N.t("np.nothing");
                $("#_np_a").textContent = "";
                $("#_np_state").textContent = state.toUpperCase();
                return;
            }
            $("#_np_t").textContent = p[1] || "";
            $("#_np_a").textContent = [p[2], p[3]].filter(Boolean).join(" — ");
            $("#_np_state").textContent = state.toUpperCase();
            $("#_np_pp").innerHTML = state === "playing" ? window.ICONS.pause : window.ICONS.play;
            const dur = parseFloat(p[4]) || 0, pos = parseFloat(p[5]) || 0;
            $("#_np_bar").style.width = (dur > 0 ? Math.min(100, (pos / dur) * 100) : 0) + "%";
        };
        tick();
        const iv = setInterval(tick, 1500);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
