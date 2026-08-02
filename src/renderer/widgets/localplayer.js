"use strict";
// Local music-folder player: point it at a directory and play any audio the
// engine supports (mp3/flac/m4a/aac/ogg/opus/wav/…). No streaming, no DRM.
window.I18N.register({
    en: {
        "widget.localplayer": "Music Folder", "lp.pick": "Choose music folder…", "lp.change": "Change",
        "lp.empty": "No audio files found in this folder.", "lp.hint": "Pick a folder — subfolders are scanned too.",
        "lp.filter": "Filter tracks…"
    },
    ru: {
        "widget.localplayer": "Музыка (папка)", "lp.pick": "Выбрать папку с музыкой…", "lp.change": "Сменить",
        "lp.empty": "В этой папке не найдено аудиофайлов.", "lp.hint": "Выбери папку — вложенные тоже сканируются.",
        "lp.filter": "Фильтр треков…"
    }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.localplayer = {
    id: "localplayer",
    title: "widget.localplayer",
    category: "media",
    description: "Play music from a local folder — any format",
    defaultSize: { w: 6, h: 6 },
    mount(body) {
        const I = window.I18N, t = k => I.t(k);
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const ICON = window.ICONS;
        const fmt = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
        // Build a file:// URL that survives spaces / unicode / Windows drive letters.
        const fileUrl = p => "file://" + (/^[A-Za-z]:/.test(p) ? "/" : "") + p.replace(/\\/g, "/").split("/")
            .map(seg => /^[A-Za-z]:$/.test(seg) ? seg : encodeURIComponent(seg)).join("/");

        let alive = true, tracks = [], view = [], idx = -1, shuffle = false, dir = "";

        body.innerHTML = `
            <div class="lp">
                <audio class="lp-audio" preload="metadata"></audio>
                <div class="lp-empty" data-ref="empty"></div>
                <div class="lp-main" data-ref="main" style="display:none">
                    <div class="np-title" data-ref="title">—</div>
                    <div class="np-artist" data-ref="sub"></div>
                    <div class="np-seek" data-ref="seek"><div class="bar"><i data-ref="bar"></i></div><div class="np-seek-head" data-ref="head"></div></div>
                    <div class="np-times"><span data-ref="pos">0:00</span><span data-ref="dur">0:00</span></div>
                    <div class="np-controls">
                        <button class="tgl" data-ref="shuf" title="Shuffle">${ICON.shuffle}</button>
                        <button data-ref="prev" title="Previous">${ICON.prev}</button>
                        <button class="pp" data-ref="pp" title="Play / Pause">${ICON.play}</button>
                        <button data-ref="next" title="Next">${ICON.next}</button>
                        <span style="flex:1"></span>
                        <span data-ref="count" style="color:var(--text-dim);font-size:10px"></span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
                        <span style="color:var(--text-dim);font-size:10.5px">VOL</span>
                        <input type="range" min="0" max="100" data-ref="vol" style="flex:1;accent-color:var(--accent)">
                        <button data-ref="change" class="lp-chg">${t("lp.change")}</button>
                    </div>
                    <input data-ref="filter" placeholder="${t("lp.filter")}" spellcheck="false" style="margin-top:8px">
                    <div class="lp-list" data-ref="list"></div>
                </div>
            </div>`;
        const R = {}; body.querySelectorAll("[data-ref]").forEach(el => R[el.getAttribute("data-ref")] = el);
        const audio = body.querySelector(".lp-audio");

        const showEmpty = (msg, withPick) => {
            R.main.style.display = "none"; R.empty.style.display = "block";
            R.empty.innerHTML = `<b>${esc(msg)}</b><br><span style="color:var(--text-dim)">${t("lp.hint")}</span>`;
            if (withPick) { const b = document.createElement("button"); b.textContent = t("lp.pick"); b.className = "lp-chg"; b.style.marginTop = "10px"; b.onclick = pick; R.empty.appendChild(document.createElement("br")); R.empty.appendChild(b); }
        };

        const renderList = () => {
            const q = (R.filter.value || "").trim().toLowerCase();
            view = q ? tracks.filter(tr => tr.name.toLowerCase().includes(q)) : tracks;
            R.list.innerHTML = view.map(tr => {
                const active = tr === tracks[idx];
                return `<div class="lp-row${active ? " on" : ""}" data-p="${esc(tr.path)}">${esc(tr.name.replace(/\.[^.]+$/, ""))}</div>`;
            }).join("");
            R.list.querySelectorAll(".lp-row").forEach(el => el.onclick = () => { const i = tracks.findIndex(tr => tr.path === el.dataset.p); if (i >= 0) playAt(i); });
            R.count.textContent = tracks.length + " tracks";
        };

        const playAt = (i) => {
            if (i < 0 || i >= tracks.length) return;
            idx = i;
            const tr = tracks[idx];
            audio.src = fileUrl(tr.path);
            audio.play().catch(() => {});
            R.title.textContent = tr.name.replace(/\.[^.]+$/, "");
            R.sub.textContent = tr.path.replace(/[/\\][^/\\]*$/, "");
            renderList();
        };
        const nextIdx = () => shuffle ? (tracks.length > 1 ? (Math.floor(Math.random() * (tracks.length - 1)) + idx + 1) % tracks.length : 0) : (idx + 1) % tracks.length;
        const prevIdx = () => (idx - 1 + tracks.length) % tracks.length;

        R.pp.onclick = () => { if (!tracks.length) return; if (idx < 0) return playAt(0); audio.paused ? audio.play().catch(() => {}) : audio.pause(); };
        R.next.onclick = () => tracks.length && playAt(nextIdx());
        R.prev.onclick = () => tracks.length && playAt(prevIdx());
        R.shuf.onclick = () => { shuffle = !shuffle; R.shuf.classList.toggle("on", shuffle); };
        R.change.onclick = pick;
        R.filter.addEventListener("input", renderList);

        // seek
        let seeking = false;
        const fracAt = x => { const r = R.seek.querySelector(".bar").getBoundingClientRect(); return r.width ? Math.max(0, Math.min(1, (x - r.left) / r.width)) : 0; };
        R.seek.addEventListener("pointerdown", e => { if (!audio.duration) return; seeking = true; R.seek.classList.add("seeking"); try { R.seek.setPointerCapture(e.pointerId); } catch (_) {} const f = fracAt(e.clientX); R.bar.style.width = R.head.style.left = (f * 100) + "%"; });
        R.seek.addEventListener("pointermove", e => { if (seeking) { const f = fracAt(e.clientX); R.bar.style.width = R.head.style.left = (f * 100) + "%"; R.pos.textContent = fmt(f * audio.duration); } });
        R.seek.addEventListener("pointerup", e => { if (!seeking) return; seeking = false; R.seek.classList.remove("seeking"); if (audio.duration) audio.currentTime = fracAt(e.clientX) * audio.duration; });

        audio.addEventListener("timeupdate", () => { if (seeking || !audio.duration) return; const f = audio.currentTime / audio.duration; R.bar.style.width = R.head.style.left = (f * 100) + "%"; R.pos.textContent = fmt(audio.currentTime); R.dur.textContent = fmt(audio.duration); });
        audio.addEventListener("play", () => R.pp.innerHTML = ICON.pause);
        audio.addEventListener("pause", () => R.pp.innerHTML = ICON.play);
        audio.addEventListener("ended", () => tracks.length && playAt(nextIdx()));
        audio.addEventListener("error", () => { if (idx >= 0 && tracks.length > 1) playAt(nextIdx()); }); // skip unplayable format
        let volTimer = 0;
        R.vol.addEventListener("input", () => { audio.volume = R.vol.value / 100; clearTimeout(volTimer); volTimer = setTimeout(() => window.dyo.settings.set({ musicVol: Number(R.vol.value) }), 300); });

        let scanSeq = 0;
        async function scan(d) {
            const seq = ++scanSeq;
            R.empty.style.display = "block"; R.empty.innerHTML = "<b>Scanning…</b>";
            const res = await window.dyo.media.scan(d).catch(() => null);
            if (!alive || seq !== scanSeq) return; // stale scan: a newer one is in flight / finished
            if (!res || res.error) {
                if (tracks.length) { R.empty.style.display = "none"; R.main.style.display = "block"; return; } // failed rescan: keep current playlist
                showEmpty(res && res.error ? res.error : t("lp.empty"), true); return;
            }
            tracks = res.files || []; idx = -1;
            if (!tracks.length) { showEmpty(t("lp.empty"), true); return; }
            R.empty.style.display = "none"; R.main.style.display = "block";
            renderList();
        }
        async function pick() {
            const d = await window.dyo.media.pickDir().catch(() => null);
            if (!d || !alive) return;
            dir = d; window.dyo.settings.set({ musicDir: d }); scan(d);
        }

        (async () => {
            const s = await window.dyo.settings.get();
            if (!alive) return;
            if (s && s.musicVol != null) { R.vol.value = s.musicVol; audio.volume = s.musicVol / 100; } else { R.vol.value = 80; audio.volume = 0.8; }
            if (s && s.musicDir) { dir = s.musicDir; scan(dir); } else showEmpty(t("lp.pick").replace("…", ""), true);
        })();

        return { destroy: () => { alive = false; try { audio.pause(); audio.src = ""; } catch (e) {} } };
    }
};
