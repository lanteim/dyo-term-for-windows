"use strict";
window.I18N.register({
    en: { "widget.iac_tfplan": "Terraform Plan", "cat.iac": "IaC" },
    ru: { "widget.iac_tfplan": "План Terraform", "cat.iac": "IaC" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.iac_tfplan = {
    id: "iac_tfplan",
    title: "widget.iac_tfplan",
    category: "iac",
    description: "terraform plan summary (detailed-exitcode): add/change/destroy counts",
    defaultSize: { w: 8, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
          <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <button id="_tp_run" style="background:var(--accent);color:var(--bg-elevated);border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font-family:var(--font-mono);font-size:11.5px">Run plan</button>
              <button id="_tp_term" style="background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;cursor:pointer;font-family:var(--font-mono);font-size:11.5px">Run in terminal</button>
              <span id="_tp_st" style="color:var(--text-dim);margin-left:auto;font-size:11px"></span>
            </div>
            <div style="color:var(--accent);font-size:10.5px">⚠ plan can be slow; capped at 20s timeout</div>
            <div style="display:flex;gap:14px;font-size:13px">
              <span>+ <b id="_tp_add" style="color:var(--accent2)">—</b></span>
              <span>~ <b id="_tp_chg" style="color:var(--accent)">—</b></span>
              <span>- <b id="_tp_del" style="color:var(--danger)">—</b></span>
            </div>
            <div id="_tp_verdict" style="font-size:11.5px"></div>
            <div id="_tp_out" style="flex:1;overflow:auto;font-family:var(--font-mono);font-size:11px;white-space:pre-wrap;color:var(--text-dim);border-top:1px solid var(--border);padding-top:4px"></div>
          </div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const cwd = () => (window.term ? window.term.lastCwd : undefined);

        const run = async () => {
            if (!alive || busy) return;
            busy = true; $("#_tp_st").textContent = "planning…";
            $("#_tp_add").textContent = $("#_tp_chg").textContent = $("#_tp_del").textContent = "…";
            $("#_tp_verdict").textContent = "";
            try {
                const r = await window.dyo.exec("terraform", ["plan", "-no-color", "-input=false", "-detailed-exitcode"], { cwd: cwd(), timeout: 20000 });
                if (!alive) return;
                if (!r) { $("#_tp_st").textContent = "no response"; return; }
                const out = ((r.stdout || "") + "\n" + (r.stderr || "")).trim();
                // exitcode: 0 = no changes, 1 = error, 2 = changes present
                if (r.code === 1) {
                    const err = (r.stderr || "").trim().split("\n").slice(0, 6).join("\n") || "terraform error";
                    $("#_tp_add").textContent = $("#_tp_chg").textContent = $("#_tp_del").textContent = "—";
                    $("#_tp_verdict").innerHTML = `<span style="color:var(--danger)">plan failed / not initialized</span>`;
                    $("#_tp_out").textContent = err;
                    $("#_tp_st").textContent = "error";
                    return;
                }
                const m = out.match(/Plan:\s*(\d+)\s+to add,\s*(\d+)\s+to change,\s*(\d+)\s+to destroy/i);
                if (m) {
                    $("#_tp_add").textContent = m[1];
                    $("#_tp_chg").textContent = m[2];
                    $("#_tp_del").textContent = m[3];
                    $("#_tp_verdict").innerHTML = `<span style="color:var(--accent)">changes pending</span>`;
                } else if (/No changes\./i.test(out) || r.code === 0) {
                    $("#_tp_add").textContent = $("#_tp_chg").textContent = $("#_tp_del").textContent = "0";
                    $("#_tp_verdict").innerHTML = `<span style="color:var(--accent2)">✓ no changes — infrastructure matches config</span>`;
                } else {
                    $("#_tp_verdict").textContent = "completed (unparsed summary)";
                }
                $("#_tp_out").textContent = out.split("\n").slice(-60).join("\n");
                $("#_tp_st").textContent = "done " + new Date().toLocaleTimeString();
            } catch (e) {
                if (alive) { $("#_tp_st").textContent = "error"; $("#_tp_out").textContent = String(e && e.message); }
            } finally { busy = false; }
        };
        $("#_tp_run").onclick = run;
        $("#_tp_term").onclick = () => { window.term.runInFocused("terraform plan\n"); $("#_tp_st").textContent = "sent to terminal"; };

        return { destroy: () => { alive = false; } };
    }
};
