"use strict";
window.I18N.register({
    en: { "widget.ref_sqlcheat": "SQL Cheat-Sheet", "cat.reference": "Reference" },
    ru: { "widget.ref_sqlcheat": "SQL шпаргалка", "cat.reference": "Справочник" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.ref_sqlcheat = {
    id: "ref_sqlcheat",
    title: "widget.ref_sqlcheat",
    category: "reference",
    description: "SQL cheat-sheet, searchable; click to copy",
    defaultSize: { w: 8, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const DATA = [
            ["Query", [
                ["SELECT * FROM t WHERE cond;", "Basic filtered select"],
                ["SELECT col AS alias FROM t;", "Column alias"],
                ["SELECT DISTINCT col FROM t;", "Unique values"],
                ["... ORDER BY col DESC LIMIT 10;", "Sort and limit"],
                ["... WHERE col IN (1,2,3);", "Match a set"],
                ["... WHERE col BETWEEN a AND b;", "Range filter"],
                ["... WHERE col LIKE 'a%';", "Pattern match"],
                ["... WHERE col IS NULL;", "Null check"]
            ]],
            ["Aggregate", [
                ["SELECT COUNT(*) FROM t;", "Row count"],
                ["SELECT col, COUNT(*) FROM t GROUP BY col;", "Count per group"],
                ["... GROUP BY col HAVING COUNT(*) > 1;", "Filter groups"],
                ["SELECT SUM(x), AVG(x), MIN(x), MAX(x) FROM t;", "Aggregations"],
                ["SELECT col, ROW_NUMBER() OVER (ORDER BY x) FROM t;", "Window function"]
            ]],
            ["Joins", [
                ["FROM a JOIN b ON a.id = b.a_id", "Inner join"],
                ["FROM a LEFT JOIN b ON a.id = b.a_id", "Keep all left rows"],
                ["FROM a RIGHT JOIN b ON ...", "Keep all right rows"],
                ["FROM a FULL OUTER JOIN b ON ...", "Keep all rows"],
                ["FROM a CROSS JOIN b", "Cartesian product"]
            ]],
            ["Modify", [
                ["INSERT INTO t (a,b) VALUES (1,2);", "Insert a row"],
                ["INSERT INTO t SELECT ... FROM s;", "Insert from query"],
                ["UPDATE t SET a=1 WHERE id=5;", "Update rows"],
                ["DELETE FROM t WHERE id=5;", "Delete rows"],
                ["TRUNCATE TABLE t;", "Remove all rows fast"]
            ]],
            ["DDL", [
                ["CREATE TABLE t (id INT PRIMARY KEY, name TEXT);", "Create table"],
                ["ALTER TABLE t ADD COLUMN c INT;", "Add a column"],
                ["ALTER TABLE t DROP COLUMN c;", "Drop a column"],
                ["CREATE INDEX idx ON t (col);", "Create an index"],
                ["DROP TABLE IF EXISTS t;", "Drop a table"]
            ]],
            ["CTE & subquery", [
                ["WITH cte AS (SELECT ...) SELECT * FROM cte;", "Common table expression"],
                ["SELECT * FROM t WHERE x IN (SELECT ...);", "Subquery in WHERE"],
                ["SELECT *, (SELECT COUNT(*) FROM u) FROM t;", "Scalar subquery"],
                ["SELECT COALESCE(a, b, 0) FROM t;", "First non-null value"],
                ["SELECT CASE WHEN x>0 THEN 'pos' ELSE 'neg' END FROM t;", "Conditional expression"]
            ]]
        ];
        window.__refCheatRender(body, DATA, esc, "Search SQL snippets…");
        return { destroy: () => body._cheatCleanup && body._cheatCleanup() };
    }
};

window.__refCheatRender = window.__refCheatRender || function (body, DATA, esc, placeholder) {
    body.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%;gap:6px">
          <input class="_ch_q" placeholder="${esc(placeholder)}" style="width:100%;box-sizing:border-box;background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 8px;font-family:var(--font-mono);font-size:12px">
          <div class="_ch_toast" style="height:14px;font-size:10.5px;color:var(--accent2)"></div>
          <div class="_ch_list" style="overflow:auto;flex:1"></div>
        </div>`;
    const q = body.querySelector("._ch_q");
    const list = body.querySelector("._ch_list");
    const toast = body.querySelector("._ch_toast");
    let toastT = null;
    const render = () => {
        const s = q.value.trim().toLowerCase();
        let html = "";
        DATA.forEach(([sec, items]) => {
            const rows = items.filter(([cmd, desc]) => !s || cmd.toLowerCase().includes(s) || desc.toLowerCase().includes(s));
            if (!rows.length) return;
            html += `<div style="font-size:10.5px;text-transform:uppercase;letter-spacing:1px;color:var(--text-dim);margin:8px 0 4px">${esc(sec)}</div>`;
            html += rows.map(([cmd, desc]) => `<div class="_ch_item" data-cmd="${esc(cmd)}" title="Click to copy" style="cursor:pointer;padding:4px 8px;border:1px solid var(--border);border-radius:6px;margin-bottom:4px;background:var(--bg-elevated)">
                <div style="font-family:var(--font-mono);font-size:11.5px;color:var(--accent)">${esc(cmd)}</div>
                <div style="font-size:11px;color:var(--text-dim);margin-top:1px">${esc(desc)}</div></div>`).join("");
        });
        list.innerHTML = html || `<div style="color:var(--text-dim);font-size:12px;padding:8px">No matches.</div>`;
    };
    const onClick = e => {
        const it = e.target.closest("._ch_item");
        if (!it) return;
        const cmd = it.dataset.cmd;
        navigator.clipboard.writeText(cmd).then(() => {
            toast.textContent = "Copied: " + cmd;
            clearTimeout(toastT);
            toastT = setTimeout(() => { toast.textContent = ""; }, 1600);
        }).catch(() => { toast.textContent = "Copy failed"; });
    };
    q.addEventListener("input", render);
    list.addEventListener("click", onClick);
    render();
    body._cheatCleanup = () => {
        q.removeEventListener("input", render);
        list.removeEventListener("click", onClick);
        clearTimeout(toastT);
    };
};
