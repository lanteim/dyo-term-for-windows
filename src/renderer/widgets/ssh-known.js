"use strict";
window.I18N.register({
    en: { "widget.sshknown": "SSH Known / Favorites", "cat.ssh": "SSH" },
    ru: { "widget.sshknown": "SSH known / избранное", "cat.ssh": "SSH" }
});
window.WIDGETS = window.WIDGETS || {};

(function () {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
    const shq = s => "'" + String(s).replace(/'/g, "'\\''") + "'";

    window.WIDGETS.sshknown = {
        id: "sshknown",
        title: "widget.sshknown",
        category: "ssh",
        description: "known_hosts count + favorite quick-connect hosts",
        defaultSize: { w: 6, h: 3 },
        mount(body) {
            let alive = true;
            let favorites = [];

            body.innerHTML = `
                <div class="metric-row"><span class="k">known_hosts</span><span class="v" id="_shk_count">…</span></div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin:8px 0 6px">
                    <span style="color:var(--text-dim);font-size:11px">favorites</span>
                    <button id="_shk_add" title="Add favorite" style="border:1px dashed var(--border-strong);background:transparent;color:var(--accent);border-radius:6px;padding:2px 8px;cursor:pointer;font-family:var(--font-ui);font-size:11px">+ fav</button>
                </div>
                <div id="_shk_favs" style="display:flex;flex-wrap:wrap;gap:6px;align-content:flex-start;overflow:auto"></div>`;
            const countEl = body.querySelector("#_shk_count");
            const favs = body.querySelector("#_shk_favs");

            function save() { window.dyo.settings.set({ "ssh.favorites": favorites }); }

            function renderFavs() {
                favs.innerHTML = "";
                if (!favorites.length) {
                    favs.innerHTML = `<div style="color:var(--text-dim);font-size:12px">No favorites yet.</div>`;
                    return;
                }
                favorites.forEach((h, i) => {
                    const b = document.createElement("button");
                    b.textContent = h;
                    b.title = "ssh " + h + "  (right-click to remove)";
                    b.style.cssText = "border:1px solid var(--border);background:var(--bg-elevated);color:var(--text);border-radius:8px;padding:6px 10px;cursor:pointer;font-family:var(--font-mono);font-size:12px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
                    b.onclick = () => { if (window.term) window.term.runInFocused("ssh " + shq(h) + "\n"); };
                    b.oncontextmenu = (e) => { e.preventDefault(); favorites.splice(i, 1); save(); renderFavs(); };
                    favs.appendChild(b);
                });
            }

            async function loadKnown() {
                if (!alive) return;
                try {
                    const ai = await window.dyo.appInfo();
                    const home = ai && ai.home ? ai.home : "";
                    if (!home) { countEl.textContent = "—"; return; }
                    const res = await window.dyo.fs.read(home + "/.ssh/known_hosts");
                    if (!res || res.error || res.content == null) {
                        countEl.textContent = "not found";
                        countEl.style.color = "var(--text-dim)";
                        return;
                    }
                    const n = res.content.split(/\r?\n/).filter(l => l.trim() && l.charAt(0) !== "#").length;
                    countEl.textContent = n + " entr" + (n === 1 ? "y" : "ies");
                    countEl.style.color = "var(--text)";
                } catch (e) {
                    countEl.textContent = "unavailable";
                    countEl.style.color = "var(--text-dim)";
                }
            }

            body.querySelector("#_shk_add").onclick = () => {
                const h = prompt("Favorite host (name or user@host):");
                if (!h) return;
                const host = h.trim();
                if (!host || favorites.indexOf(host) >= 0) return;
                favorites.push(host);
                save();
                renderFavs();
            };

            window.dyo.settings.get().then(s => {
                if (!alive) return;
                if (s && Array.isArray(s["ssh.favorites"])) favorites = s["ssh.favorites"].slice();
                renderFavs();
            });

            renderFavs();
            loadKnown();
            const iv = setInterval(loadKnown, 10000);
            return { destroy: () => { alive = false; clearInterval(iv); } };
        }
    };
})();
