"use strict";
window.I18N.register({
    en: { "widget.info_locale": "Locale", "cat.system": "System" },
    ru: { "widget.info_locale": "Локаль", "cat.system": "Система" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

    window.WIDGETS.info_locale = {
        id: "info_locale",
        title: "widget.info_locale",
        category: "system",
        description: "Language, timezone, calendar and number formatting",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="color:var(--text-dim)">🌐 LOCALE</span>
                    <b class="_lang" style="color:var(--accent);cursor:pointer" title="Click to copy">—</b>
                    <span class="_now" style="color:var(--text-dim);margin-left:auto;font-family:var(--font-mono);font-size:11px"></span>
                  </div>
                  <div class="metric-row"><span class="k">LANGUAGES</span><span class="v _langs" style="font-family:var(--font-mono);max-width:66%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">—</span></div>
                  <div class="metric-row"><span class="k">TIMEZONE</span><span class="v _tz" style="font-family:var(--font-mono);cursor:pointer" title="Click to copy">—</span></div>
                  <div class="metric-row"><span class="k">UTC OFFSET</span><span class="v _off" style="font-family:var(--font-mono)">—</span></div>
                  <div class="metric-row"><span class="k">CALENDAR</span><span class="v _cal" style="font-family:var(--font-mono)">—</span></div>
                  <div class="metric-row"><span class="k">NUMBERS</span><span class="v _num" style="font-family:var(--font-mono)">—</span></div>
                </div>`;
            const $ = s => body.querySelector(s);
            let alive = true, iv = null;

            const copyEl = (sel) => { const t = $(sel).textContent.trim(); if (t && t !== "—") navigator.clipboard.writeText(t).catch(() => {}); };
            $("._lang").onclick = () => copyEl("._lang");
            $("._tz").onclick = () => copyEl("._tz");

            try {
                const nav = window.navigator || {};
                const lang = nav.language || "—";
                const langs = Array.isArray(nav.languages) && nav.languages.length ? nav.languages.join(", ") : lang;
                let ro = {};
                try { ro = Intl.DateTimeFormat().resolvedOptions() || {}; } catch (e) { ro = {}; }
                const tz = ro.timeZone || "—";
                let numsys = "—";
                try { numsys = (Intl.NumberFormat().resolvedOptions().numberingSystem) || "—"; } catch (e) {}
                const offMin = -(new Date().getTimezoneOffset());
                const sign = offMin >= 0 ? "+" : "-";
                const ah = Math.floor(Math.abs(offMin) / 60), am = Math.abs(offMin) % 60;
                const off = "UTC" + sign + String(ah).padStart(2, "0") + ":" + String(am).padStart(2, "0");

                $("._lang").textContent = lang;
                $("._langs").textContent = langs;
                $("._langs").title = langs;
                $("._tz").textContent = tz;
                $("._off").textContent = off;
                $("._cal").textContent = ro.calendar || "—";
                $("._num").textContent = numsys;
            } catch (e) {
                $("._lang").textContent = "error";
            }

            const upd = () => {
                if (!alive) return;
                try { $("._now").textContent = new Date().toLocaleString(navigator.language || undefined); } catch (e) {}
            };
            upd();
            iv = setInterval(upd, 1000);
            return { destroy: () => { alive = false; if (iv) clearInterval(iv); } };
        }
    };
})();
