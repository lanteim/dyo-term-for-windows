"use strict";
window.I18N.register({
    en: { "widget.tool_hash": "Hash Generator", "cat.tools": "Tools" },
    ru: { "widget.tool_hash": "Генератор Хешей", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.tool_hash = {
    id: "tool_hash",
    title: "widget.tool_hash",
    category: "tools",
    description: "SHA-1/256/512 of text via WebCrypto",
    defaultSize: { w: 8, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono);font-size:12px";
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:8px;height:100%">
                <textarea class="hs-in" placeholder="text to hash…" style="${inp};resize:none;min-height:56px;flex:0 0 auto" spellcheck="false"></textarea>
                <div class="hs-out" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:6px"></div>
            </div>`;
        const hin = body.querySelector(".hs-in");
        const hout = body.querySelector(".hs-out");
        hin.value = "hello world";
        const algos = ["SHA-1", "SHA-256", "SHA-512"];
        let alive = true, token = 0;
        const toHex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");

        const run = async () => {
            const myToken = ++token;
            const data = new TextEncoder().encode(hin.value);
            hout.innerHTML = "";
            for (const a of algos) {
                const wrap = document.createElement("div");
                wrap.style.cssText = "border:1px solid var(--border);border-radius:6px;padding:6px 8px;background:var(--bg-elevated);cursor:pointer";
                wrap.innerHTML = `<div style="font-size:11px;color:var(--accent2);margin-bottom:2px">${a}</div><div class="hv" style="font-family:var(--font-mono);font-size:11px;word-break:break-all">…</div>`;
                hout.appendChild(wrap);
                const vEl = wrap.querySelector(".hv");
                try {
                    const digest = await crypto.subtle.digest(a, data);
                    if (!alive || myToken !== token) return;
                    const hex = toHex(digest);
                    vEl.textContent = hex;
                    wrap.title = "Click to copy";
                    wrap.onclick = () => {
                        navigator.clipboard.writeText(hex).catch(() => {});
                        const o = wrap.style.borderColor; wrap.style.borderColor = "var(--accent)";
                        setTimeout(() => { wrap.style.borderColor = o; }, 400);
                    };
                } catch (e) {
                    vEl.innerHTML = `<span style="color:var(--danger)">unavailable</span>`;
                }
            }
        };
        hin.oninput = run;
        run();
        return { destroy() { alive = false; hin.oninput = null; } };
    }
};
