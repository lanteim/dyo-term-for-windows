"use strict";
window.I18N.register({
    en: { "widget.web_jwt": "JWT Decoder", "cat.web": "Web / API" },
    ru: { "widget.web_jwt": "JWT-декодер", "cat.web": "Веб / API" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.web_jwt = {
    id: "web_jwt",
    title: "widget.web_jwt",
    category: "web",
    description: "Decode JWT header + payload (no signature verification)",
    defaultSize: { w: 12, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inputCss = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:12px";
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:6px;font-size:12px">
            <textarea class="_w_in" spellcheck="false" placeholder="Paste JWT (xxxxx.yyyyy.zzzzz)…" style="${inputCss};height:56px;resize:none"></textarea>
            <div style="color:var(--text-dim);font-size:11px">Signature is NOT verified — decode only.</div>
            <div class="_w_claims" style="font-size:11px"></div>
            <div style="display:flex;gap:6px;flex:1;min-height:0">
              <div style="display:flex;flex-direction:column;gap:3px;flex:1;min-height:0">
                <label style="color:var(--text-dim)">Header</label>
                <pre class="_w_h" style="${inputCss};flex:1;margin:0;overflow:auto;white-space:pre-wrap;word-break:break-word"></pre>
              </div>
              <div style="display:flex;flex-direction:column;gap:3px;flex:1;min-height:0">
                <label style="color:var(--text-dim)">Payload</label>
                <pre class="_w_p" style="${inputCss};flex:1;margin:0;overflow:auto;white-space:pre-wrap;word-break:break-word"></pre>
              </div>
            </div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true;

        const b64urlDecode = str => {
            let s = String(str).replace(/-/g, "+").replace(/_/g, "/");
            while (s.length % 4) s += "=";
            const bin = atob(s);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            return new TextDecoder().decode(bytes);
        };
        const fmtTs = ts => {
            if (typeof ts !== "number") return "";
            const d = new Date(ts * 1000);
            if (isNaN(d.getTime())) return "";
            return d.toLocaleString(window.I18N.locale());
        };

        const decode = () => {
            const raw = $("._w_in").value.trim();
            $("._w_claims").innerHTML = "";
            if (!raw) { $("._w_h").textContent = ""; $("._w_p").textContent = ""; return; }
            const parts = raw.split(".");
            if (parts.length < 2) {
                $("._w_h").innerHTML = `<span style="color:var(--danger)">Not a JWT (need header.payload.signature)</span>`;
                $("._w_p").textContent = ""; return;
            }
            let payloadObj = null;
            try { const j = JSON.parse(b64urlDecode(parts[0])); $("._w_h").textContent = JSON.stringify(j, null, 2); }
            catch (e) { $("._w_h").innerHTML = `<span style="color:var(--danger)">header: ${esc(e && e.message)}</span>`; }
            try { payloadObj = JSON.parse(b64urlDecode(parts[1])); $("._w_p").textContent = JSON.stringify(payloadObj, null, 2); }
            catch (e) { $("._w_p").innerHTML = `<span style="color:var(--danger)">payload: ${esc(e && e.message)}</span>`; }
            if (payloadObj) {
                const rows = [];
                if (payloadObj.exp != null) {
                    const exp = fmtTs(payloadObj.exp);
                    const expired = typeof payloadObj.exp === "number" && payloadObj.exp * 1000 < Date.now();
                    rows.push(`<span class="k">exp</span> <span style="color:${expired ? "var(--danger)" : "var(--accent)"}">${esc(exp)}${expired ? " (EXPIRED)" : ""}</span>`);
                }
                if (payloadObj.iat != null) rows.push(`<span class="k">iat</span> ${esc(fmtTs(payloadObj.iat))}`);
                if (payloadObj.nbf != null) rows.push(`<span class="k">nbf</span> ${esc(fmtTs(payloadObj.nbf))}`);
                $("._w_claims").innerHTML = rows.join(" &nbsp;·&nbsp; ");
            }
        };
        $("._w_in").addEventListener("input", decode);

        return { destroy: () => { alive = false; } };
    }
};
