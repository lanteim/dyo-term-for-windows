"use strict";
window.I18N.register({
    en: { "widget.tx2_repeat": "Repeat Text", "cat.tools": "Tools" },
    ru: { "widget.tx2_repeat": "Повтор текста", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.tx2_repeat = {
    id: "tx2_repeat",
    title: "widget.tx2_repeat",
    category: "tools",
    description: "Repeat the input text N times with an optional separator (live)",
    defaultSize: { w: 8, h: 6 },
    mount(body) {
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:6px;height:100%">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <label style="font-size:11px;color:var(--text-dim)">times <input type="number" id="_rp_n" value="3" min="0" max="100000" style="width:70px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono)"></label>
              <select id="_rp_sep" style="background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono);font-size:12px">
                <option value="nl">newline sep</option>
                <option value="none">no separator</option>
                <option value="space">space sep</option>
                <option value="comma">comma sep</option>
              </select>
              <button id="_rp_copy" style="cursor:pointer">Copy</button>
              <span id="_rp_msg" style="color:var(--text-dim);font-size:11px"></span>
            </div>
            <textarea id="_rp_in" spellcheck="false" placeholder="text to repeat" style="flex:1;min-height:50px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
            <textarea id="_rp_out" spellcheck="false" readonly style="flex:1;min-height:50px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
          </div>`;
        const $ = s => body.querySelector(s);
        const inp = $("#_rp_in"), out = $("#_rp_out"), num = $("#_rp_n"), sel = $("#_rp_sep"), msg = $("#_rp_msg");
        const seps = { nl: "\n", none: "", space: " ", comma: "," };
        const MAX = 5000000;

        const run = () => {
            const src = inp.value;
            let n = parseInt(num.value, 10);
            if (!Number.isFinite(n) || n < 0) n = 0;
            if (src === "" || n === 0) { out.value = ""; msg.textContent = ""; return; }
            const sep = seps[sel.value] || "";
            const total = src.length * n + sep.length * (n - 1);
            if (total > MAX) {
                out.value = "";
                msg.innerHTML = `<span style="color:var(--danger)">too large (${total.toLocaleString()} chars, max ${MAX.toLocaleString()})</span>`;
                return;
            }
            out.value = Array(n).fill(src).join(sep);
            msg.innerHTML = `<span style="color:var(--text-dim)">${out.value.length.toLocaleString()} chars</span>`;
        };
        const copy = () => { if (out.value) { navigator.clipboard.writeText(out.value); msg.innerHTML = `<span style="color:var(--accent)">copied</span>`; } };

        inp.addEventListener("input", run);
        num.addEventListener("input", run);
        sel.addEventListener("change", run);
        $("#_rp_copy").addEventListener("click", copy);

        return { destroy() { inp.removeEventListener("input", run); num.removeEventListener("input", run); sel.removeEventListener("change", run); } };
    }
};
