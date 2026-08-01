"use strict";
window.I18N.register({
    en: { "widget.ai": "AI Assistant", "cat.ai": "AI" },
    ru: { "widget.ai": "AI ассистент", "cat.ai": "AI" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.ai = {
    id: "ai",
    title: "widget.ai",
    category: "ai",
    description: "OpenAI-compatible chat (works with Ollama too)",
    defaultSize: { w: 12, h: 6 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const DEF_URL = "https://api.openai.com/v1";
        const DEF_MODEL = "gpt-4o-mini";
        let alive = true, sending = false;
        let cfg = { baseUrl: DEF_URL, apiKey: "", model: DEF_MODEL };

        const wrapCss = "display:flex;flex-direction:column;height:100%;gap:8px;font-size:12px";
        const btnCss = "background:transparent;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 9px;cursor:pointer;font-size:11px";
        const inCss = "background:var(--bg-elevated);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:var(--font-mono);font-size:12px";

        const showConfig = () => {
            body.innerHTML = `
              <div style="${wrapCss}">
                <div style="color:var(--text-dim);font-size:11px">Configure an OpenAI-compatible endpoint. Local Ollama: baseUrl <code>http://localhost:11434/v1</code>.</div>
                <label style="display:flex;flex-direction:column;gap:3px">Base URL
                  <input id="_ai_url" value="${esc(cfg.baseUrl)}" style="${inCss}"/></label>
                <label style="display:flex;flex-direction:column;gap:3px">API Key
                  <input id="_ai_key" type="password" placeholder="sk-… (any value for Ollama)" value="${esc(cfg.apiKey)}" style="${inCss}"/></label>
                <label style="display:flex;flex-direction:column;gap:3px">Model
                  <input id="_ai_model" value="${esc(cfg.model)}" style="${inCss}"/></label>
                <div style="display:flex;gap:8px;align-items:center">
                  <button id="_ai_save" style="${btnCss}">Save</button>
                  <span id="_ai_cfgmeta" style="color:var(--text-dim);font-size:11px"></span>
                </div>
              </div>`;
            body.querySelector("#_ai_save").onclick = async () => {
                cfg.baseUrl = (body.querySelector("#_ai_url").value.trim() || DEF_URL);
                cfg.apiKey = body.querySelector("#_ai_key").value.trim();
                cfg.model = (body.querySelector("#_ai_model").value.trim() || DEF_MODEL);
                await window.dyo.settings.set({ "ai.baseUrl": cfg.baseUrl, "ai.apiKey": cfg.apiKey, "ai.model": cfg.model });
                if (!alive) return;
                showChat();
            };
        };

        const showChat = () => {
            body.innerHTML = `
              <div style="${wrapCss}">
                <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                  <span style="color:var(--accent2);font-size:11px">● ${esc(cfg.model)}</span>
                  <span style="color:var(--text-dim);font-size:11px">${esc(cfg.baseUrl)}</span>
                  <button id="_ai_cfg" style="${btnCss};margin-left:auto">⚙ Config</button>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  <button class="_ai_q" data-p="explain" style="${btnCss}">Explain last output</button>
                  <button class="_ai_q" data-p="fix" style="${btnCss}">Fix my last command</button>
                  <button class="_ai_q" data-p="regex" style="${btnCss}">Regex for…</button>
                  <button class="_ai_q" data-p="sql" style="${btnCss}">SQL helper</button>
                </div>
                <div id="_ai_out" style="flex:1;overflow:auto;background:var(--terminal-bg);border:1px solid var(--border);border-radius:6px;padding:8px;white-space:pre-wrap;font-family:var(--font-mono);font-size:11.5px;line-height:1.5;color:var(--text)">Ask something…</div>
                <div style="display:flex;gap:6px;align-items:flex-end">
                  <textarea id="_ai_in" placeholder="Prompt — ⌘↵ to send" spellcheck="false" style="flex:1;height:52px;resize:vertical;${inCss}"></textarea>
                  <button id="_ai_send" style="${btnCss};padding:8px 14px">Send</button>
                </div>
              </div>`;
            const $ = s => body.querySelector(s);
            $("#_ai_cfg").onclick = showConfig;
            const input = $("#_ai_in");
            $("#_ai_in").focus();

            const PRESETS = {
                explain: "Explain what the following terminal output means, and what (if anything) went wrong:\n\n",
                fix: "My last shell command failed. Here is the command and its error output. Explain the cause and give a corrected command:\n\n",
                regex: "Write a regular expression that matches: ",
                sql: "Act as a SQL helper. I want to: "
            };
            body.querySelectorAll("._ai_q").forEach(b => {
                b.onclick = () => {
                    const p = PRESETS[b.getAttribute("data-p")] || "";
                    input.value = p;
                    input.focus();
                    input.selectionStart = input.selectionEnd = input.value.length;
                };
            });

            const send = async () => {
                if (sending) return;
                const prompt = input.value.trim();
                if (!prompt) return;
                sending = true;
                $("#_ai_send").disabled = true;
                $("#_ai_out").textContent = "Thinking…";
                try {
                    const r = await window.dyo.http(cfg.baseUrl.replace(/\/+$/, "") + "/chat/completions", {
                        method: "POST",
                        headers: { "Authorization": "Bearer " + cfg.apiKey, "Content-Type": "application/json" },
                        body: JSON.stringify({ model: cfg.model, messages: [{ role: "user", content: prompt }] }),
                        timeout: 60000
                    });
                    if (!alive) return;
                    if (!r || r.error || !r.ok) {
                        let msg = (r && r.error) || ("HTTP " + (r && r.status));
                        if (r && r.text) { try { const j = JSON.parse(r.text); if (j.error) msg = j.error.message || JSON.stringify(j.error); } catch (e) {} }
                        $("#_ai_out").innerHTML = `<span style="color:var(--danger)">${esc(msg)}</span>`;
                        return;
                    }
                    const j = JSON.parse(r.text);
                    const content = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
                    $("#_ai_out").textContent = content != null ? content : JSON.stringify(j).slice(0, 2000);
                } catch (e) {
                    if (alive) $("#_ai_out").innerHTML = `<span style="color:var(--danger)">Error: ${esc(e && e.message)}</span>`;
                } finally {
                    sending = false;
                    if (alive) $("#_ai_send").disabled = false;
                }
            };
            $("#_ai_send").onclick = send;
            input.addEventListener("keydown", e => { if (e.metaKey && e.key === "Enter") { e.preventDefault(); send(); } });
        };

        window.dyo.settings.get().then(s => {
            if (!alive) return;
            cfg.baseUrl = (s && s["ai.baseUrl"]) || DEF_URL;
            cfg.apiKey = (s && s["ai.apiKey"]) || "";
            cfg.model = (s && s["ai.model"]) || DEF_MODEL;
            if (cfg.apiKey) showChat(); else showConfig();
        });

        return { destroy: () => { alive = false; } };
    }
};
