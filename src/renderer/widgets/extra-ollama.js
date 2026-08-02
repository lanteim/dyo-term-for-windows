"use strict";
window.I18N.register({
    en: { "widget.extra_ollama": "Ollama Models", "cat.data": "Data" },
    ru: { "widget.extra_ollama": "Модели Ollama", "cat.data": "Данные" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.extra_ollama = {
    id: "extra_ollama",
    title: "widget.extra_ollama",
    category: "data",
    description: "Local Ollama models; run a prompt in the terminal",
    defaultSize: { w: 8, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        let alive = true, busy = false;

        body.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px">
              <div style="display:flex;gap:6px;align-items:center">
                <span style="color:var(--accent);font-weight:600">ollama</span>
                <button class="_ref">Refresh</button>
                <span class="_st" style="color:var(--text-dim);margin-left:auto"></span>
              </div>
              <div class="_models" style="max-height:38%;overflow:auto;border:1px solid var(--border);border-radius:6px"></div>
              <div style="display:flex;gap:6px;align-items:center">
                <select class="_sel" style="width:170px"></select>
                <span style="color:var(--text-dim)">model</span>
              </div>
              <textarea class="_prompt" placeholder="Type a prompt, then Run in terminal…" style="flex:1;min-height:48px;resize:none"></textarea>
              <div style="display:flex;gap:6px">
                <button class="_run" style="border-color:var(--accent)">Run in terminal</button>
              </div>
            </div>`;
        const $ = s => body.querySelector(s);
        ["._ref", "._run"].forEach(s => { $(s).style.cssText += ";background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;cursor:pointer;font-family:var(--font-mono)"; });
        $("._sel").style.cssText += ";background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px;font-family:var(--font-mono)";
        $("._prompt").style.cssText += ";background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono);box-sizing:border-box";

        const load = async () => {
            if (busy || !alive) return;
            busy = true; $("._st").textContent = "loading…";
            const r = await window.dyo.exec("ollama", ["list"], { timeout: 8000 });
            busy = false;
            if (!alive) return;
            if (!r || r.code !== 0 || !r.stdout || !r.stdout.trim()) {
                const why = r && r.stderr ? r.stderr.trim().split("\n")[0] : "ollama not found";
                $("._models").innerHTML = `<div style="padding:10px;color:var(--text-dim)">Ollama unavailable — ${esc(why)}. Install from ollama.com and pull a model.</div>`;
                $("._sel").innerHTML = ""; $("._st").textContent = "";
                return;
            }
            const lines = r.stdout.trim().split("\n");
            const rows = lines.slice(1).map(l => l.split(/\s{2,}/)).filter(c => c[0]);
            if (!rows.length) {
                $("._models").innerHTML = `<div style="padding:10px;color:var(--text-dim)">No models yet. Run <code>ollama pull llama3.2</code>.</div>`;
                $("._sel").innerHTML = ""; $("._st").textContent = "0 models";
                return;
            }
            $("._models").innerHTML = rows.map(c =>
                `<div class="metric-row" style="padding:5px 8px;border-bottom:1px solid var(--border)"><span class="k">${esc(c[0])}</span><span class="v" style="color:var(--text-dim)">${esc(c[2] || "")}</span></div>`
            ).join("");
            $("._sel").innerHTML = rows.map(c => `<option>${esc(c[0])}</option>`).join("");
            $("._st").textContent = rows.length + " model" + (rows.length > 1 ? "s" : "");
        };
        $("._ref").onclick = load;
        $("._run").onclick = () => {
            const model = $("._sel").value;
            const prompt = $("._prompt").value.trim();
            if (!model) { $("._st").textContent = "no model selected"; return; }
            if (!prompt) { $("._st").textContent = "empty prompt"; return; }
            const safe = prompt.replace(/'/g, "'\\''");
            const safeModel = model.replace(/'/g, "'\\''");
            window.term.runInFocused(`ollama run '${safeModel}' '${safe}'\n`);
            $("._st").textContent = "sent to terminal";
        };
        load();

        return { destroy: () => { alive = false; } };
    }
};
