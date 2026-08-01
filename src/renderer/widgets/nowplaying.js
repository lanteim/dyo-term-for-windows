"use strict";
window.WIDGETS = window.WIDGETS || {};
window.I18N.register({
    en: {
        "np.notrunning": "Apple Music isn't running",
        "np.nothing": "Nothing playing",
        "np.open": "Open Music",
        "np.hint": "Open the Music app and press play to control it from here.",
        "np.denied": "Automation access needed",
        "np.deniedhint": "Allow dyo-term to control Music in System Settings → Privacy & Security → Automation."
    },
    ru: {
        "np.notrunning": "Apple Music не запущена",
        "np.nothing": "Ничего не играет",
        "np.open": "Открыть Music",
        "np.hint": "Открой приложение Music и включи воспроизведение — управляй отсюда.",
        "np.denied": "Нужен доступ к автоматизации",
        "np.deniedhint": "Разреши dyo-term управлять Music: Системные настройки → Конфиденциальность → Автоматизация."
    }
});

window.WIDGETS.nowplaying = {
    id: "nowplaying",
    title: "widget.nowplaying",
    category: "media",
    description: "Control Apple Music",
    defaultSize: { w: 6, h: 4 },
    mount(body) {
        const I = window.I18N;
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const fmt = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
        let alive = true, dragging = false;

        body.innerHTML = `
            <div id="_np_now" style="display:none">
                <div class="np-title" id="_np_t">—</div>
                <div class="np-artist" id="_np_a"></div>
                <div class="bar" style="margin-top:12px"><i id="_np_bar"></i></div>
                <div class="np-times"><span id="_np_pos">0:00</span><span id="_np_dur">0:00</span></div>
                <div class="np-controls">
                    <button data-a="previous" title="Previous">${window.ICONS.prev}</button>
                    <button class="pp" data-a="playpause" id="_np_pp" title="Play / Pause">${window.ICONS.play}</button>
                    <button data-a="next" title="Next">${window.ICONS.next}</button>
                    <span style="flex:1"></span>
                    <span id="_np_state" style="color:var(--text-dim);font-size:10.5px;letter-spacing:1px"></span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;margin-top:10px">
                    <span style="color:var(--text-dim);font-size:10.5px">VOL</span>
                    <input type="range" min="0" max="100" id="_np_vol" style="flex:1;accent-color:var(--accent)">
                </div>
            </div>
            <div id="_np_empty" class="np-empty" style="display:none"></div>`;

        const $ = id => body.querySelector(id);
        const nowEl = $("#_np_now"), emptyEl = $("#_np_empty");

        body.querySelectorAll("button[data-a]").forEach(b =>
            b.onclick = async () => { await window.dyo.music.control(b.dataset.a); setTimeout(tick, 150); });

        const vol = $("#_np_vol");
        vol.addEventListener("input", () => { dragging = true; });
        vol.addEventListener("change", async () => { await window.dyo.music.control({ volume: Number(vol.value) }); setTimeout(() => { dragging = false; }, 600); });

        const showEmpty = (titleKey, hintKey, withOpen) => {
            nowEl.style.display = "none";
            emptyEl.style.display = "block";
            emptyEl.innerHTML = `<b>${I.t(titleKey)}</b><br>${I.t(hintKey)}`;
            if (withOpen) {
                const btn = document.createElement("button");
                btn.textContent = I.t("np.open");
                btn.onclick = () => window.dyo.exec("open", ["-a", "Music"]);
                emptyEl.appendChild(document.createElement("br"));
                emptyEl.appendChild(btn);
            }
        };

        const tick = async () => {
            if (!alive) return;
            const out = await window.dyo.music.state();

            if (out === null) { showEmpty("np.denied", "np.deniedhint", false); return; }
            if (typeof out === "string" && out.startsWith("__ERR__")) {
                // Show the real osascript error (permission/identity/timeout)
                nowEl.style.display = "none";
                emptyEl.style.display = "block";
                emptyEl.innerHTML = `<b>${I.t("np.denied")}</b><br>${I.t("np.deniedhint")}<br><span style="color:var(--danger);font-size:10.5px">${esc(out.slice(7))}</span>`;
                return;
            }
            if (out === "notrunning" || out === "") { showEmpty("np.notrunning", "np.hint", true); return; }

            const p = out.split("\t");
            const state = p[0];
            if (state !== "playing" && state !== "paused") { showEmpty("np.nothing", "np.hint", true); return; }

            emptyEl.style.display = "none";
            nowEl.style.display = "block";
            $("#_np_t").textContent = p[1] || "";
            $("#_np_a").textContent = [p[2], p[3]].filter(Boolean).join(" — ");
            $("#_np_state").textContent = state.toUpperCase();
            $("#_np_pp").innerHTML = state === "playing" ? window.ICONS.pause : window.ICONS.play;
            const dur = parseFloat(p[4]) || 0, pos = parseFloat(p[5]) || 0;
            $("#_np_bar").style.width = (dur > 0 ? Math.min(100, (pos / dur) * 100) : 0) + "%";
            $("#_np_pos").textContent = fmt(pos);
            $("#_np_dur").textContent = fmt(dur);
            const v = parseFloat(p[6]);
            if (!dragging && !isNaN(v)) vol.value = v;
        };
        tick();
        const iv = setInterval(tick, 1500);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
