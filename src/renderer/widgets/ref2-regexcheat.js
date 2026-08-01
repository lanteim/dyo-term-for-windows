"use strict";
window.I18N.register({
    en: { "widget.ref2_regexcheat": "Regex Cheat-Sheet", "cat.reference": "Reference" },
    ru: { "widget.ref2_regexcheat": "Шпаргалка Regex", "cat.reference": "Справочник" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.ref2_regexcheat = {
    id: "ref2_regexcheat",
    title: "widget.ref2_regexcheat",
    category: "reference",
    description: "Regex token cheat-sheet; click a token to copy",
    defaultSize: { w: 8, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const groups = [
            ["Character classes", [
                [".", "any char except newline"], ["\\d", "digit [0-9]"], ["\\D", "non-digit"],
                ["\\w", "word char [A-Za-z0-9_]"], ["\\W", "non-word char"], ["\\s", "whitespace"],
                ["\\S", "non-whitespace"], ["[abc]", "any of a, b, c"], ["[^abc]", "none of a, b, c"], ["[a-z]", "range a to z"]
            ]],
            ["Anchors", [
                ["^", "start of string / line"], ["$", "end of string / line"], ["\\b", "word boundary"],
                ["\\B", "non-word boundary"]
            ]],
            ["Quantifiers", [
                ["*", "0 or more"], ["+", "1 or more"], ["?", "0 or 1 (optional)"],
                ["{n}", "exactly n"], ["{n,}", "n or more"], ["{n,m}", "between n and m"], ["*?", "lazy: as few as possible"]
            ]],
            ["Groups & refs", [
                ["(…)", "capturing group"], ["(?:…)", "non-capturing group"], ["(?<name>…)", "named group"],
                ["\\1", "backreference to group 1"], ["a|b", "a or b (alternation)"]
            ]],
            ["Lookaround", [
                ["(?=…)", "positive lookahead"], ["(?!…)", "negative lookahead"],
                ["(?<=…)", "positive lookbehind"], ["(?<!…)", "negative lookbehind"]
            ]],
            ["Flags", [
                ["g", "global (all matches)"], ["i", "case-insensitive"], ["m", "multiline ^$"],
                ["s", "dotall (. matches newline)"], ["u", "unicode"], ["y", "sticky"]
            ]]
        ];
        body.innerHTML = `
            <div style="overflow:auto;height:100%;display:flex;flex-direction:column;gap:8px" id="_rx_root">
              ${groups.map(([title, items]) => `
                <div>
                  <div style="color:var(--text-dim);font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">${esc(title)}</div>
                  <div style="display:flex;flex-wrap:wrap;gap:4px">
                    ${items.map(([tok, desc]) =>
            `<span data-tok="${esc(tok)}" title="${esc(desc)} — click to copy"
                          style="cursor:pointer;background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;padding:3px 7px;font-family:var(--font-mono);font-size:11.5px;display:inline-flex;gap:6px;align-items:baseline">
                        <b style="color:var(--accent)">${esc(tok)}</b><span style="color:var(--text-dim);font-size:10.5px">${esc(desc)}</span>
                      </span>`).join("")}
                  </div>
                </div>`).join("")}
              <div id="_rx_hint" style="color:var(--text-dim);font-size:10.5px">Click any token to copy it.</div>
            </div>`;
        const root = body.querySelector("#_rx_root");
        const hint = body.querySelector("#_rx_hint");
        const onClick = e => {
            const el = e.target.closest("span[data-tok]");
            if (!el) return;
            navigator.clipboard.writeText(el.getAttribute("data-tok")).then(() => {
                hint.textContent = "Copied: " + el.getAttribute("data-tok");
                setTimeout(() => { hint.textContent = "Click any token to copy it."; }, 900);
            }).catch(() => {});
        };
        root.addEventListener("click", onClick);
        return { destroy() { root.removeEventListener("click", onClick); } };
    }
};
