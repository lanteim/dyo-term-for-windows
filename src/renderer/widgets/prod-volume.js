"use strict";
window.I18N.register({
    en: { "widget.prod-volume": "Output Volume", "cat.media": "Media" },
    ru: { "widget.prod-volume": "Громкость вывода", "cat.media": "Медиа" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS["prod-volume"] = {
    id: "prod-volume",
    title: "widget.prod-volume",
    category: "media",
    description: "System output volume slider (macOS)",
    defaultSize: { w: 6, h: 2 },
    mount(body) {
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;justify-content:center;height:100%;gap:8px">
                <div class="metric-row"><span class="k">🔊 OUTPUT VOLUME</span><span class="v"><b id="_vol_p">—</b></span></div>
                <input id="_vol_slider" type="range" min="0" max="100" value="0" step="1"
                    style="width:100%;accent-color:var(--accent);cursor:pointer">
                <div id="_vol_msg" style="color:var(--text-dim);font-size:11px;min-height:14px"></div>
            </div>`;
        const $ = s => body.querySelector(s);
        const slider = $("#_vol_slider"), pct = $("#_vol_p"), msg = $("#_vol_msg");
        let alive = true;
        let dragging = false;
        let setBusy = false;
        let pollIv = null;

        const readVolume = async () => {
            if (!alive || dragging || setBusy) return;
            try {
                const r = await window.dyo.exec("osascript", ["-e", "output volume of (get volume settings)"], { timeout: 5000 });
                if (!r || r.code !== 0 || !r.stdout || !r.stdout.trim()) {
                    msg.textContent = "osascript unavailable";
                    return;
                }
                const v = parseInt(r.stdout.trim(), 10);
                if (isNaN(v)) { msg.textContent = "could not read volume"; return; }
                msg.textContent = "";
                if (!dragging) { slider.value = String(v); pct.textContent = v + "%"; }
            } catch (e) {
                msg.textContent = "osascript error";
            }
        };

        const applyVolume = async (v) => {
            setBusy = true;
            try {
                const r = await window.dyo.exec("osascript", ["-e", "set volume output volume " + v], { timeout: 5000 });
                if (!r || r.code !== 0) {
                    msg.textContent = "failed to set volume";
                } else {
                    msg.textContent = "";
                }
            } catch (e) {
                msg.textContent = "osascript error";
            } finally {
                setBusy = false;
            }
        };

        slider.addEventListener("input", () => {
            dragging = true;
            pct.textContent = slider.value + "%";
        });
        slider.addEventListener("change", () => {
            const v = Math.max(0, Math.min(100, parseInt(slider.value, 10) || 0));
            applyVolume(v).then(() => { dragging = false; });
        });

        readVolume();
        pollIv = setInterval(readVolume, 3000);
        return { destroy: () => { alive = false; if (pollIv) clearInterval(pollIv); } };
    }
};
