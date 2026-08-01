"use strict";
window.I18N.register({
    en: { "widget.dev-lsp": "Language Servers", "cat.programming": "Programming" },
    ru: { "widget.dev-lsp": "Language-серверы", "cat.programming": "Программирование" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS["dev-lsp"] = {
    id: "dev-lsp",
    title: "widget.dev-lsp",
    category: "programming",
    description: "Detect running language servers (gopls, pyright, …)",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `<div id="_lsp_body" style="overflow:auto;max-height:100%;font-family:var(--font-mono);font-size:12px"></div>`;
        const bodyEl = body.querySelector("#_lsp_body");
        let alive = true, busy = false;

        // known server binary substrings -> friendly label + language
        const SERVERS = [
            ["gopls", "gopls · Go"],
            ["rust-analyzer", "rust-analyzer · Rust"],
            ["pyright", "pyright · Python"],
            ["pylsp", "python-lsp · Python"],
            ["basedpyright", "basedpyright · Python"],
            ["typescript-language-server", "tsserver · TS/JS"],
            ["tsserver", "tsserver · TS/JS"],
            ["vtsls", "vtsls · TS/JS"],
            ["clangd", "clangd · C/C++"],
            ["lua-language-server", "lua-ls · Lua"],
            ["luals", "lua-ls · Lua"],
            ["jdtls", "jdtls · Java"],
            ["gdscript", "gdscript · GDScript"],
            ["omnisharp", "omnisharp · C#"],
            ["solargraph", "solargraph · Ruby"],
            ["ruby-lsp", "ruby-lsp · Ruby"],
            ["intelephense", "intelephense · PHP"],
            ["phpactor", "phpactor · PHP"],
            ["zls", "zls · Zig"],
            ["taplo", "taplo · TOML"],
            ["yaml-language-server", "yaml-ls · YAML"],
            ["vscode-json-language", "json-ls · JSON"],
            ["bash-language-server", "bash-ls · Bash"],
            ["deno", "deno lsp · TS/JS"],
            ["metals", "metals · Scala"],
            ["elixir-ls", "elixir-ls · Elixir"],
            ["haskell-language-server", "hls · Haskell"],
            ["texlab", "texlab · LaTeX"],
            ["marksman", "marksman · Markdown"],
            ["terraform-ls", "terraform-ls · Terraform"],
            ["dockerfile-language-server", "docker-ls · Docker"]
        ];

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const res = await window.dyo.exec("ps", ["-axo", "comm"], { timeout: 5000 });
                if (!res || res.code !== 0 || !res.stdout) {
                    bodyEl.innerHTML = `<div style="color:var(--danger);padding:6px">ps unavailable</div>`;
                    return;
                }
                const low = res.stdout.toLowerCase();
                const found = [];
                const seen = new Set();
                for (const [key, label] of SERVERS) {
                    if (low.includes(key) && !seen.has(label)) {
                        // count occurrences
                        const cnt = low.split(key).length - 1;
                        found.push({ label, cnt });
                        seen.add(label);
                    }
                }
                if (!found.length) {
                    bodyEl.innerHTML = `<div style="color:var(--text-dim);padding:6px">No known language servers running</div>`;
                    return;
                }
                bodyEl.innerHTML = found.map(f => `
                    <div class="metric-row" style="margin-bottom:5px">
                        <span class="k" style="letter-spacing:0"><span style="color:var(--accent2)">●</span> ${esc(f.label)}</span>
                        <span class="v">${f.cnt > 1 ? f.cnt + " proc" : "active"}</span>
                    </div>`).join("");
            } catch (e) {
                bodyEl.innerHTML = `<div style="color:var(--danger);padding:6px">detection error</div>`;
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 5000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
