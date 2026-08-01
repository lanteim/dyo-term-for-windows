"use strict";
window.I18N.register({
    en: { "widget.txt_sortlines": "Sort Lines", "cat.tools": "Tools" },
    ru: { "widget.txt_sortlines": "Сортировка строк", "cat.tools": "Инструменты" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.txt_sortlines = {
    id: "txt_sortlines",
    title: "widget.txt_sortlines",
    category: "tools",
    description: "Sort / reverse / unique lines with numeric & case toggles (client-side)",
    defaultSize: { w: 8, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

        body.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:6px;height:100%">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <button id="_srt_sort" style="cursor:pointer">Sort ↑</button>
              <button id="_srt_rev" style="cursor:pointer">Reverse</button>
              <label style="font-size:11px;color:var(--text-dim)"><input type="checkbox" id="_srt_num"> numeric</label>
              <label style="font-size:11px;color:var(--text-dim)"><input type="checkbox" id="_srt_ci"> ignore case</label>
              <label style="font-size:11px;color:var(--text-dim)"><input type="checkbox" id="_srt_uniq"> unique</label>
              <label style="font-size:11px;color:var(--text-dim)"><input type="checkbox" id="_srt_trim"> trim</label>
              <button id="_srt_copy" style="cursor:pointer">Copy</button>
              <span id="_srt_msg" style="color:var(--text-dim);font-size:11px"></span>
            </div>
            <textarea id="_srt_in" spellcheck="false" placeholder="banana&#10;apple&#10;cherry" style="flex:1;min-height:60px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
            <textarea id="_srt_out" spellcheck="false" readonly style="flex:1;min-height:60px;resize:none;font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px"></textarea>
          </div>`;
        const $ = s => body.querySelector(s);
        const inp = $("#_srt_in"), out = $("#_srt_out"), msg = $("#_srt_msg");

        const getLines = () => {
            let lines = inp.value.replace(/\r\n?/g, "\n").split("\n");
            if ($("#_srt_trim").checked) lines = lines.map(l => l.trim());
            return lines;
        };
        const finish = lines => {
            if ($("#_srt_uniq").checked) {
                const seen = new Set(), o = [];
                const ci = $("#_srt_ci").checked;
                for (const l of lines) { const k = ci ? l.toLowerCase() : l; if (!seen.has(k)) { seen.add(k); o.push(l); } }
                lines = o;
            }
            out.value = lines.join("\n");
            msg.innerHTML = `<span style="color:var(--accent2)">${lines.length} lines</span>`;
        };
        const doSort = dir => {
            let lines = getLines();
            const num = $("#_srt_num").checked, ci = $("#_srt_ci").checked;
            lines.sort((a, b) => {
                if (num) {
                    const na = parseFloat(a), nb = parseFloat(b);
                    const va = isNaN(na) ? Infinity : na, vb = isNaN(nb) ? Infinity : nb;
                    if (va !== vb) return va - vb;
                }
                let x = a, y = b; if (ci) { x = a.toLowerCase(); y = b.toLowerCase(); }
                return x < y ? -1 : x > y ? 1 : 0;
            });
            if (dir < 0) lines.reverse();
            finish(lines);
        };
        const doReverse = () => finish(getLines().reverse());
        const copy = () => { if (out.value) { navigator.clipboard.writeText(out.value); msg.innerHTML = `<span style="color:var(--accent)">copied</span>`; } };

        $("#_srt_sort").addEventListener("click", () => doSort(1));
        $("#_srt_rev").addEventListener("click", doReverse);
        $("#_srt_copy").addEventListener("click", copy);
        // live re-apply of unique/trim on input for convenience preview
        const live = () => { if (inp.value.trim() === "") { out.value = ""; msg.textContent = ""; } };
        inp.addEventListener("input", live);

        return { destroy() { inp.removeEventListener("input", live); } };
    }
};
