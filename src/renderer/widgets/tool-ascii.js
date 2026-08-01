"use strict";
window.I18N.register({
    en: { "widget.tool_ascii": "ASCII Banner", "cat.tools": "Tools" },
    ru: { "widget.tool_ascii": "ASCII Баннер", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.tool_ascii = {
    id: "tool_ascii",
    title: "widget.tool_ascii",
    category: "tools",
    description: "Text to big block-letter ASCII banner",
    defaultSize: { w: 9, h: 4 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const inp = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono);font-size:13px";
        const sbtn = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;font-family:var(--font-mono);font-size:12px;cursor:pointer";
        // 5-row block font. Each glyph is 5 strings of equal width.
        const F = {
            "A": ["  #  ", " # # ", "#####", "#   #", "#   #"],
            "B": ["#### ", "#   #", "#### ", "#   #", "#### "],
            "C": [" ####", "#    ", "#    ", "#    ", " ####"],
            "D": ["#### ", "#   #", "#   #", "#   #", "#### "],
            "E": ["#####", "#    ", "###  ", "#    ", "#####"],
            "F": ["#####", "#    ", "###  ", "#    ", "#    "],
            "G": [" ####", "#    ", "#  ##", "#   #", " ####"],
            "H": ["#   #", "#   #", "#####", "#   #", "#   #"],
            "I": ["###", " # ", " # ", " # ", "###"],
            "J": ["  ###", "   # ", "   # ", "#  # ", " ##  "],
            "K": ["#   #", "#  # ", "###  ", "#  # ", "#   #"],
            "L": ["#    ", "#    ", "#    ", "#    ", "#####"],
            "M": ["#   #", "## ##", "# # #", "#   #", "#   #"],
            "N": ["#   #", "##  #", "# # #", "#  ##", "#   #"],
            "O": [" ### ", "#   #", "#   #", "#   #", " ### "],
            "P": ["#### ", "#   #", "#### ", "#    ", "#    "],
            "Q": [" ### ", "#   #", "# # #", "#  # ", " ## #"],
            "R": ["#### ", "#   #", "#### ", "#  # ", "#   #"],
            "S": [" ####", "#    ", " ### ", "    #", "#### "],
            "T": ["#####", "  #  ", "  #  ", "  #  ", "  #  "],
            "U": ["#   #", "#   #", "#   #", "#   #", " ### "],
            "V": ["#   #", "#   #", "#   #", " # # ", "  #  "],
            "W": ["#   #", "#   #", "# # #", "## ##", "#   #"],
            "X": ["#   #", " # # ", "  #  ", " # # ", "#   #"],
            "Y": ["#   #", " # # ", "  #  ", "  #  ", "  #  "],
            "Z": ["#####", "   # ", "  #  ", " #   ", "#####"],
            "0": [" ### ", "#  ##", "# # #", "##  #", " ### "],
            "1": ["  #  ", " ##  ", "  #  ", "  #  ", " ### "],
            "2": [" ### ", "#   #", "  ## ", " #   ", "#####"],
            "3": ["#### ", "    #", " ### ", "    #", "#### "],
            "4": ["#  # ", "#  # ", "#####", "   # ", "   # "],
            "5": ["#####", "#    ", "#### ", "    #", "#### "],
            "6": [" ### ", "#    ", "#### ", "#   #", " ### "],
            "7": ["#####", "   # ", "  #  ", " #   ", " #   "],
            "8": [" ### ", "#   #", " ### ", "#   #", " ### "],
            "9": [" ### ", "#   #", " ####", "    #", " ### "],
            "!": ["#", "#", "#", " ", "#"],
            "?": [" ### ", "#   #", "  ## ", "     ", "  #  "],
            ".": [" ", " ", " ", " ", "#"],
            ",": ["  ", "  ", "  ", " #", "# "],
            "-": ["   ", "   ", "###", "   ", "   "],
            "_": ["    ", "    ", "    ", "    ", "####"],
            "+": ["   ", " # ", "###", " # ", "   "],
            ":": [" ", "#", " ", "#", " "],
            "/": ["    #", "   # ", "  #  ", " #   ", "#    "],
            " ": ["   ", "   ", "   ", "   ", "   "]
        };
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:8px;height:100%">
                <div style="display:flex;gap:6px;align-items:center">
                    <input class="as-in" value="HELLO" placeholder="text…" style="${inp};flex:1" />
                    <button class="as-copy" style="${sbtn}">Copy</button>
                </div>
                <pre class="as-out" style="flex:1;overflow:auto;margin:0;font-family:var(--font-mono);font-size:11px;line-height:1.1;color:var(--accent);white-space:pre"></pre>
            </div>`;
        const ain = body.querySelector(".as-in");
        const copy = body.querySelector(".as-copy");
        const out = body.querySelector(".as-out");
        let currentText = "";
        const render = () => {
            const chars = ain.value.toUpperCase().split("");
            const rows = ["", "", "", "", ""];
            for (const ch of chars) {
                const g = F[ch] || F["?"];
                for (let r = 0; r < 5; r++) rows[r] += g[r] + " ";
            }
            currentText = rows.join("\n");
            out.textContent = currentText || "";
        };
        ain.oninput = render;
        copy.onclick = () => navigator.clipboard.writeText(currentText).catch(() => {});
        render();
        return { destroy() { ain.oninput = copy.onclick = null; } };
    }
};
