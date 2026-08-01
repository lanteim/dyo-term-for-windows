"use strict";
window.I18N.register({
    en: { "widget.tx2_jsonescape": "JSON String Escape", "cat.tools": "Tools" },
    ru: { "widget.tx2_jsonescape": "JSON-экранирование", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.tx2_jsonescape = {
    id: "tx2_jsonescape",
    title: "widget.tx2_jsonescape",
    category: "tools",
    description: "Escape or unescape text as a JSON string literal (live)",
    defaultSize: { w: 8, h: 6 },
    mount(body) {
        const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:6px;height:100%">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <select id="_je_mode" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:12px">
                <option value="esc">escape → JSON string</option>
                <option value="unesc">unescape ← JSON string</option>
              </select>
              <label style="font-size:11px;color:var(--text-dim)"><input type="checkbox" id="_je_quotes"> wrap in quotes</label>
              <button id="_je_copy" style="cursor:pointer">Copy</button>
              <span id="_je_msg" style="color:var(--text-dim);font-size:11px"></span>
            </div>
            <textarea id="_je_in" spellcheck="false" placeholder="Type text to escape..." style="flex:1;min-height:50px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
            <textarea id="_je_out" spellcheck="false" readonly style="flex:1;min-height:50px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
          </div>`;
        const $ = s => body.querySelector(s);
        const inp = $("#_je_in"), out = $("#_je_out"), mode = $("#_je_mode"), qbox = $("#_je_quotes"), msg = $("#_je_msg");

        const run = () => {
            const src = inp.value;
            msg.textContent = "";
            if (src === "") { out.value = ""; return; }
            if (mode.value === "esc") {
                let s = JSON.stringify(src); // includes surrounding quotes
                if (!qbox.checked) s = s.slice(1, -1);
                out.value = s;
                msg.innerHTML = `<span style="color:var(--text-dim)">${out.value.length} chars</span>`;
            } else {
                let t = src.trim();
                if (!(t.startsWith('"') && t.endsWith('"'))) t = '"' + t.replace(/"/g, '\\"') + '"';
                try {
                    const v = JSON.parse(t);
                    out.value = String(v);
                    msg.innerHTML = `<span style="color:var(--accent2)">ok</span>`;
                } catch (e) {
                    out.value = "";
                    msg.innerHTML = `<span style="color:var(--danger)">${esc(e.message)}</span>`;
                }
            }
        };
        const copy = () => { if (out.value) { navigator.clipboard.writeText(out.value); msg.innerHTML = `<span style="color:var(--accent)">copied</span>`; } };
        const syncQ = () => { qbox.disabled = mode.value !== "esc"; };

        inp.addEventListener("input", run);
        mode.addEventListener("change", () => { syncQ(); run(); });
        qbox.addEventListener("change", run);
        $("#_je_copy").addEventListener("click", copy);
        syncQ();

        return { destroy() { inp.removeEventListener("input", run); qbox.removeEventListener("change", run); } };
    }
};
