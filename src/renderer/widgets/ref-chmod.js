"use strict";
window.I18N.register({
    en: { "widget.ref_chmod": "chmod Calculator", "cat.reference": "Reference" },
    ru: { "widget.ref_chmod": "Калькулятор chmod", "cat.reference": "Справочник" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.ref_chmod = {
    id: "ref_chmod",
    title: "widget.ref_chmod",
    category: "reference",
    description: "chmod calculator: rwx checkboxes for u/g/o <-> octal, live",
    defaultSize: { w: 7, h: 4 },
    mount(body) {
        const groups = ["u", "g", "o"];
        const gLabel = { u: "Owner (u)", g: "Group (g)", o: "Others (o)" };
        const perms = ["r", "w", "x"];
        const pVal = { r: 4, w: 2, x: 1 };
        const state = { u: { r: true, w: true, x: false }, g: { r: true, w: false, x: false }, o: { r: true, w: false, x: false } };

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:10px;height:100%;font-family:var(--font-mono)">
              <div id="_cm_grid" style="display:flex;gap:14px;flex-wrap:wrap"></div>
              <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
                <label style="font-size:11px;color:var(--text-dim)">Octal
                  <input id="_cm_oct" maxlength="4" style="width:64px;margin-left:6px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;color:var(--accent);padding:5px 8px;font-family:var(--font-mono);font-size:15px;font-weight:600;text-align:center">
                </label>
                <div id="_cm_sym" style="font-size:16px;color:var(--text);letter-spacing:2px"></div>
              </div>
              <div id="_cm_cmd" title="Click to copy" style="cursor:pointer;background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;padding:6px 8px;font-size:12px;color:var(--text)"></div>
              <div id="_cm_hint" style="font-size:10.5px;color:var(--text-dim)"></div>
            </div>`;
        const grid = body.querySelector("#_cm_grid");
        const octI = body.querySelector("#_cm_oct");
        const symEl = body.querySelector("#_cm_sym");
        const cmdEl = body.querySelector("#_cm_cmd");
        const hintEl = body.querySelector("#_cm_hint");

        grid.innerHTML = groups.map(g => `
            <div style="border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:var(--bg-elevated)">
              <div style="font-size:11px;color:var(--text-dim);margin-bottom:6px">${gLabel[g]}</div>
              ${perms.map(p => `<label style="display:block;font-size:12px;color:var(--text);cursor:pointer;padding:2px 0">
                <input type="checkbox" data-g="${g}" data-p="${p}"> ${p} <span style="color:var(--text-dim)">(${pVal[p]})</span></label>`).join("")}
            </div>`).join("");

        const boxes = Array.from(grid.querySelectorAll("input[type=checkbox]"));
        const digit = g => perms.reduce((n, p) => n + (state[g][p] ? pVal[p] : 0), 0);
        const symOf = g => perms.map(p => state[g][p] ? p : "-").join("");

        const render = () => {
            boxes.forEach(b => { b.checked = state[b.dataset.g][b.dataset.p]; });
            const oct = groups.map(digit).join("");
            octI.value = oct;
            symEl.textContent = "-" + groups.map(symOf).join("");
            cmdEl.textContent = "chmod " + oct + " file";
            const readable = groups.map(g => gLabel[g].split(" ")[0] + ": " + (symOf(g) === "---" ? "none" : symOf(g))).join("  ·  ");
            hintEl.textContent = readable;
        };
        const onBox = e => { const b = e.target; state[b.dataset.g][b.dataset.p] = b.checked; render(); };
        boxes.forEach(b => b.addEventListener("change", onBox));

        const onOct = () => {
            const v = octI.value.replace(/[^0-7]/g, "").slice(-3).padStart(3, "0");
            if (v.length === 3) {
                groups.forEach((g, i) => {
                    const d = parseInt(v[i], 8);
                    state[g].r = !!(d & 4); state[g].w = !!(d & 2); state[g].x = !!(d & 1);
                });
                render();
            }
        };
        octI.addEventListener("input", onOct);
        const onCopy = () => navigator.clipboard.writeText(cmdEl.textContent).catch(() => {});
        cmdEl.addEventListener("click", onCopy);
        render();
        return {
            destroy: () => {
                boxes.forEach(b => b.removeEventListener("change", onBox));
                octI.removeEventListener("input", onOct);
                cmdEl.removeEventListener("click", onCopy);
            }
        };
    }
};
