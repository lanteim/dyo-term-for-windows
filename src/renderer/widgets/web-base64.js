"use strict";
window.I18N.register({
    en: { "widget.web_base64": "Base64", "cat.web": "Web / API" },
    ru: { "widget.web_base64": "Base64", "cat.web": "Веб / API" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.web_base64 = {
    id: "web_base64",
    title: "widget.web_base64",
    category: "web",
    description: "Encode/decode Base64 with UTF-8 support",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inputCss = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:12px";
        const btnCss = "background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 10px;cursor:pointer;font-size:11px";
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <button class="_b_enc" style="${btnCss}">Text → Base64</button>
              <button class="_b_dec" style="${btnCss}">Base64 → Text</button>
              <button class="_b_swap" style="${btnCss}">Swap</button>
              <button class="_b_copy" style="${btnCss}">Copy out</button>
              <span class="_b_status" style="color:var(--text-dim);flex:1;text-align:right"></span>
            </div>
            <div style="display:flex;gap:6px;flex:1;min-height:0">
              <div style="display:flex;flex-direction:column;gap:3px;flex:1;min-height:0">
                <label style="color:var(--text-dim)">Input</label>
                <textarea class="_b_in" spellcheck="false" style="${inputCss};flex:1;resize:none"></textarea>
              </div>
              <div style="display:flex;flex-direction:column;gap:3px;flex:1;min-height:0">
                <label style="color:var(--text-dim)">Output</label>
                <textarea class="_b_out" spellcheck="false" readonly style="${inputCss};flex:1;resize:none"></textarea>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true;

        const encode = () => {
            try {
                const bytes = new TextEncoder().encode($("._b_in").value);
                let bin = "";
                bytes.forEach(b => bin += String.fromCharCode(b));
                $("._b_out").value = btoa(bin);
                $("._b_status").innerHTML = `<span style="color:var(--accent)">encoded</span>`;
            } catch (e) { $("._b_status").innerHTML = `<span style="color:var(--danger)">${esc(e && e.message)}</span>`; }
        };
        const decode = () => {
            try {
                const bin = atob($("._b_in").value.trim());
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                $("._b_out").value = new TextDecoder().decode(bytes);
                $("._b_status").innerHTML = `<span style="color:var(--accent)">decoded</span>`;
            } catch (e) { $("._b_status").innerHTML = `<span style="color:var(--danger)">invalid base64</span>`; }
        };
        $("._b_enc").onclick = encode;
        $("._b_dec").onclick = decode;
        $("._b_swap").onclick = () => { const v = $("._b_out").value; $("._b_out").value = $("._b_in").value; $("._b_in").value = v; };
        $("._b_copy").onclick = () => { if ($("._b_out").value) navigator.clipboard.writeText($("._b_out").value).catch(() => {}); };

        return { destroy: () => { alive = false; } };
    }
};
