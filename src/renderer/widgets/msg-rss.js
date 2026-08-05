"use strict";
window.I18N.register({
    en: { "widget.msg_rss": "RSS Feed", "cat.messaging": "Messaging" },
    ru: { "widget.msg_rss": "RSS-лента", "cat.messaging": "Сообщения" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.msg_rss = {
    id: "msg_rss",
    title: "widget.msg_rss",
    category: "messaging",
    description: "Latest 10 items from an RSS/Atom feed URL",
    defaultSize: { w: 6, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
              <div id="_rs_cfg" style="display:none;flex-direction:column;gap:6px">
                <div style="color:var(--text-dim);font-size:11px">RSS or Atom feed URL.</div>
                <input id="_rs_url" placeholder="https://example.com/feed.xml" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono)"/>
                <button id="_rs_save" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;cursor:pointer">Save</button>
              </div>
              <div id="_rs_main" style="display:none;flex-direction:column;gap:6px;height:100%;min-height:0">
                <div id="_rs_title" style="font-weight:600;color:var(--accent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">—</div>
                <div id="_rs_list" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:4px;min-height:0"></div>
                <div style="display:flex;align-items:center;gap:8px">
                  <button id="_rs_go" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px">Refresh</button>
                  <button id="_rs_edit" style="background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px">Feed</button>
                  <span id="_rs_meta" style="color:var(--text-dim);font-size:11px"></span>
                </div>
              </div>
            </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false, url = "";
        const showCfg = show => { $("#_rs_cfg").style.display = show ? "flex" : "none"; $("#_rs_main").style.display = show ? "none" : "flex"; };
        const txtOf = (el, tag) => { const n = el.getElementsByTagName(tag)[0]; return n ? (n.textContent || "").trim() : ""; };

        const tick = async () => {
            if (!alive || busy || !url) return;
            busy = true; $("#_rs_meta").textContent = "fetching…";
            try {
                const r = await window.dyo.http(url, { headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" }, timeout: 10000 });
                if (!alive) return;
                if (!r || r.error || !r.ok) {
                    $("#_rs_list").innerHTML = `<span style="color:var(--danger)">${esc((r && r.error) || ("HTTP " + (r && r.status)))}</span>`;
                    $("#_rs_meta").textContent = "unavailable"; return;
                }
                let doc;
                try { doc = new DOMParser().parseFromString(r.text, "application/xml"); } catch (e) { doc = null; }
                if (!doc || doc.getElementsByTagName("parsererror").length) {
                    $("#_rs_list").innerHTML = `<span style="color:var(--danger)">could not parse feed XML</span>`;
                    $("#_rs_meta").textContent = "parse error"; return;
                }
                const chTitle = txtOf(doc, "title");
                $("#_rs_title").textContent = chTitle || url;
                let items = Array.prototype.slice.call(doc.getElementsByTagName("item"));
                if (!items.length) items = Array.prototype.slice.call(doc.getElementsByTagName("entry"));
                const list = $("#_rs_list"); list.innerHTML = "";
                items.slice(0, 10).forEach(it => {
                    const title = txtOf(it, "title") || "(untitled)";
                    let link = txtOf(it, "link");
                    if (!link) { const la = it.getElementsByTagName("link")[0]; if (la) link = la.getAttribute("href") || ""; }
                    const date = txtOf(it, "pubDate") || txtOf(it, "updated") || txtOf(it, "published");
                    const div = document.createElement("div");
                    div.style.cssText = "cursor:" + (link ? "pointer" : "default");
                    div.innerHTML = `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">• ${esc(title)}</div>` +
                        (date ? `<div style="color:var(--text-dim);font-size:10px">${esc(date)}</div>` : "");
                    if (link) { div.title = link; div.onclick = () => window.dyo.openExternal(link); }
                    list.appendChild(div);
                });
                if (!items.length) list.innerHTML = `<span style="color:var(--text-dim)">no items in feed</span>`;
                $("#_rs_meta").textContent = "updated " + new Date().toLocaleTimeString(window.I18N.locale());
            } catch (e) {
                if (alive) $("#_rs_list").innerHTML = `<span style="color:var(--danger)">${esc(e && e.message)}</span>`;
            } finally { busy = false; }
        };

        $("#_rs_save").onclick = async () => {
            url = $("#_rs_url").value.trim();
            await window.dyo.settings.set({ "msg.rss.url": url });
            if (url) { showCfg(false); tick(); }
        };
        $("#_rs_edit").onclick = () => showCfg(true);
        $("#_rs_go").onclick = tick;

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            url = (s && s["msg.rss.url"]) || "";
            $("#_rs_url").value = url;
            if (!url) showCfg(true); else { showCfg(false); tick(); }
        });

        const iv = setInterval(tick, 120000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
