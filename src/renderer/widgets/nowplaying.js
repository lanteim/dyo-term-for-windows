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
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        const I = window.I18N;
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const fmt = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
        const num = s => parseFloat(String(s == null ? "" : s).replace(",", ".")); // tolerate comma decimals
        let alive = true, dragging = false, seeking = false, ticking = false;
        let curDur = 0, curShuffle = false, curRepeat = "off", curFav = false;
        const REPEAT_CYCLE = { off: "all", all: "one", one: "off" };

        body.innerHTML = `
            <div id="_np_now" style="display:none">
                <div class="np-title" id="_np_t">—</div>
                <div class="np-artist" id="_np_a"></div>
                <div class="np-seek" id="_np_seek" title="Drag to seek">
                    <div class="bar"><i id="_np_bar"></i></div>
                    <div class="np-seek-head" id="_np_head"></div>
                </div>
                <div class="np-times"><span id="_np_pos">0:00</span><span id="_np_dur">0:00</span></div>
                <div class="np-controls">
                    <button class="tgl" data-a="shuffle" id="_np_shuf" title="Shuffle">${window.ICONS.shuffle}</button>
                    <button data-a="previous" title="Previous">${window.ICONS.prev}</button>
                    <button class="pp" data-a="playpause" id="_np_pp" title="Play / Pause">${window.ICONS.play}</button>
                    <button data-a="next" title="Next">${window.ICONS.next}</button>
                    <button class="tgl" data-a="repeat" id="_np_rep" title="Repeat">${window.ICONS.repeat}</button>
                    <span style="flex:1"></span>
                    <button class="tgl fav" data-a="favorite" id="_np_fav" title="Favorite">${window.ICONS.heart}</button>
                </div>
                <div style="display:flex;align-items:center;gap:8px;margin-top:10px">
                    <span style="color:var(--text-dim);font-size:10.5px">VOL</span>
                    <input type="range" min="0" max="100" id="_np_vol" style="flex:1;accent-color:var(--accent)">
                    <span id="_np_state" style="color:var(--text-dim);font-size:10px;letter-spacing:1px;min-width:56px;text-align:right"></span>
                </div>
            </div>
            <div id="_np_empty" class="np-empty" style="display:none"></div>`;

        const $ = id => body.querySelector(id);
        const nowEl = $("#_np_now"), emptyEl = $("#_np_empty");

        // Transport (prev / play-pause / next) — plain string actions
        ["previous", "playpause", "next"].forEach(a =>
            $(`button[data-a="${a}"]`).onclick = async () => { await window.dyo.music.control(a); setTimeout(tick, 150); });

        // Toggles — compute the next value from the current, reported state
        $("#_np_shuf").onclick = async () => { await window.dyo.music.control({ shuffle: !curShuffle }); setTimeout(tick, 120); };
        $("#_np_rep").onclick = async () => { await window.dyo.music.control({ repeat: REPEAT_CYCLE[curRepeat] || "off" }); setTimeout(tick, 120); };
        $("#_np_fav").onclick = async () => { await window.dyo.music.control({ favorite: !curFav }); setTimeout(tick, 120); };

        // Seekable progress bar (click or drag anywhere on the track)
        const seekEl = $("#_np_seek");
        const fracAt = clientX => {
            const r = seekEl.querySelector(".bar").getBoundingClientRect();
            return r.width ? Math.max(0, Math.min(1, (clientX - r.left) / r.width)) : 0;
        };
        const paint = f => { $("#_np_bar").style.width = (f * 100) + "%"; $("#_np_head").style.left = (f * 100) + "%"; $("#_np_pos").textContent = fmt(f * curDur); };
        seekEl.addEventListener("pointerdown", e => {
            if (!curDur) return;
            seeking = true; seekEl.classList.add("seeking");
            try { seekEl.setPointerCapture(e.pointerId); } catch (_) {}
            paint(fracAt(e.clientX));
        });
        seekEl.addEventListener("pointermove", e => { if (seeking) paint(fracAt(e.clientX)); });
        const endSeek = async e => {
            if (!seeking) return;
            const f = fracAt(e.clientX);
            seeking = false; seekEl.classList.remove("seeking");
            await window.dyo.music.control({ seek: Math.round(f * curDur) });
            setTimeout(tick, 150);
        };
        seekEl.addEventListener("pointerup", endSeek);
        seekEl.addEventListener("pointercancel", () => { seeking = false; seekEl.classList.remove("seeking"); });

        // Volume
        const vol = $("#_np_vol");
        vol.addEventListener("input", () => { dragging = true; });
        vol.addEventListener("change", async () => { await window.dyo.music.control({ volume: Number(vol.value) }); setTimeout(() => { dragging = false; }, 600); });
        // `change` doesn't fire when the thumb is released at its committed value — clear the flag on release too
        const endVolDrag = () => { setTimeout(() => { dragging = false; }, 600); };
        vol.addEventListener("pointerup", endVolDrag);
        vol.addEventListener("pointercancel", endVolDrag);

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

        // One state query at a time — the 1.5s interval is shorter than osascript's
        // timeout, so unguarded ticks overlap and can resolve out of order.
        const tick = async () => {
            if (!alive || ticking) return;
            ticking = true;
            try { await tickInner(); } finally { ticking = false; }
        };
        const tickInner = async () => {
            const out = await window.dyo.music.state();

            if (out === null) { showEmpty("np.denied", "np.deniedhint", false); return; }
            if (typeof out === "string" && out.startsWith("__ERR__")) {
                nowEl.style.display = "none";
                emptyEl.style.display = "block";
                emptyEl.innerHTML = `<b>${I.t("np.denied")}</b><br>${I.t("np.deniedhint")}<br><span style="color:var(--danger);font-size:10.5px">${esc(out.slice(7))}</span>`;
                return;
            }
            if (out === "notrunning" || out === "") { showEmpty("np.notrunning", "np.hint", true); return; }

            const p = out.split("\t");
            // Track name/artist/album may legally contain tabs; the trailing 6 fields
            // (duration…favorite) are machine-formatted and never do, so fold any
            // extra tokens back into the metadata instead of shifting the columns.
            if (p.length > 10) {
                const extra = p.length - 10;
                p.splice(1, 1 + extra, p.slice(1, 2 + extra).join("\t"));
            }
            const state = p[0];
            if (state !== "playing" && state !== "paused") { showEmpty("np.nothing", "np.hint", true); return; }

            emptyEl.style.display = "none";
            nowEl.style.display = "block";
            $("#_np_t").textContent = p[1] || "";
            $("#_np_a").textContent = [p[2], p[3]].filter(Boolean).join(" — ");
            $("#_np_state").textContent = state.toUpperCase();
            $("#_np_pp").innerHTML = state === "playing" ? window.ICONS.pause : window.ICONS.play;

            curDur = num(p[4]) || 0;
            const pos = num(p[5]) || 0;
            if (!seeking) {
                const pct = curDur > 0 ? Math.min(100, (pos / curDur) * 100) : 0;
                $("#_np_bar").style.width = pct + "%";
                $("#_np_head").style.left = pct + "%";
                $("#_np_pos").textContent = fmt(pos);
            }
            $("#_np_dur").textContent = fmt(curDur);

            const v = num(p[6]);
            if (!dragging && !isNaN(v)) vol.value = v;

            // Shuffle / repeat / favorite toggle states
            curShuffle = p[7] === "true";
            curRepeat = (p[8] === "one" || p[8] === "all") ? p[8] : "off";
            curFav = p[9] === "true";
            $("#_np_shuf").classList.toggle("on", curShuffle);
            const rep = $("#_np_rep");
            rep.classList.toggle("on", curRepeat !== "off");
            rep.innerHTML = curRepeat === "one" ? window.ICONS.repeatOne : window.ICONS.repeat;
            rep.title = "Repeat: " + curRepeat;
            $("#_np_fav").classList.toggle("on", curFav);
        };
        tick();
        const iv = setInterval(tick, 1500);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
