"use strict";
window.I18N.register({
    en: { "widget.txt_numbase": "Number Base", "cat.tools": "Tools" },
    ru: { "widget.txt_numbase": "Системы счисления", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.txt_numbase = {
    id: "txt_numbase",
    title: "widget.txt_numbase",
    category: "tools",
    description: "Convert a number between binary / octal / decimal / hex, live (client-side)",
    defaultSize: { w: 6, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

        const fields = [
            { id: "bin", label: "BIN (2)", base: 2, re: /^[01]+$/ },
            { id: "oct", label: "OCT (8)", base: 8, re: /^[0-7]+$/ },
            { id: "dec", label: "DEC (10)", base: 10, re: /^\d+$/ },
            { id: "hex", label: "HEX (16)", base: 16, re: /^[0-9a-fA-F]+$/ }
        ];

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:8px;height:100%">
            ${fields.map(f => `
              <label style="display:flex;align-items:center;gap:8px;font-family:var(--font-mono);font-size:12px">
                <span style="width:64px;color:var(--text-dim)">${f.label}</span>
                <input id="_nb_${f.id}" spellcheck="false" placeholder="0" style="flex:1;font-family:var(--font-mono);font-size:13px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px" />
              </label>`).join("")}
            <div id="_nb_msg" style="color:var(--text-dim);font-size:11px;min-height:14px"></div>
          </div>`;
        const $ = s => body.querySelector(s);
        const msg = $("#_nb_msg");
        const inputs = {};
        fields.forEach(f => { inputs[f.id] = $("#_nb_" + f.id); });

        const setAll = (n, exceptId) => {
            fields.forEach(f => {
                if (f.id === exceptId) return;
                inputs[f.id].value = n.toString(f.base).toUpperCase();
            });
        };
        const clearAll = exceptId => fields.forEach(f => { if (f.id !== exceptId) inputs[f.id].value = ""; });

        const makeHandler = f => () => {
            const raw = inputs[f.id].value.trim().replace(/^0[bxoBXO]/, "");
            if (raw === "") { clearAll(f.id); msg.textContent = ""; return; }
            if (!f.re.test(raw)) { msg.innerHTML = `<span style="color:var(--danger)">invalid digit for ${esc(f.label)}</span>`; clearAll(f.id); return; }
            let n;
            try {
                // BigInt keeps large values exact
                n = BigInt(f.base === 10 ? raw : (f.base === 16 ? "0x" + raw : f.base === 8 ? "0o" + raw : "0b" + raw));
            } catch (e) { msg.innerHTML = `<span style="color:var(--danger)">out of range</span>`; return; }
            fields.forEach(o => { if (o.id !== f.id) inputs[o.id].value = n.toString(o.base).toUpperCase(); });
            msg.innerHTML = `<span style="color:var(--accent2)">= ${n.toString(10)}</span>`;
        };

        const handlers = {};
        fields.forEach(f => { handlers[f.id] = makeHandler(f); inputs[f.id].addEventListener("input", handlers[f.id]); });

        return { destroy() { fields.forEach(f => inputs[f.id].removeEventListener("input", handlers[f.id])); } };
    }
};
