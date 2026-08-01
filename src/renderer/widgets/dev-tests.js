"use strict";
window.I18N.register({
    en: { "widget.dev-tests": "Tests", "cat.programming": "Programming" },
    ru: { "widget.dev-tests": "Тесты", "cat.programming": "Программирование" }
});
window.WIDGETS = window.WIDGETS || {};
window.WIDGETS["dev-tests"] = {
    id: "dev-tests",
    title: "widget.dev-tests",
    category: "programming",
    description: "Detect test files & framework in project",
    defaultSize: { w: 6, h: 3 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        body.innerHTML = `
            <div class="metric-row"><span class="k">FRAMEWORK</span><span class="v"><b id="_tt_fw">—</b></span></div>
            <div class="metric-row"><span class="k">TEST FILES</span><span class="v" id="_tt_n">—</span></div>
            <div id="_tt_list" style="overflow:auto;max-height:calc(100% - 60px);font-family:var(--font-mono);font-size:11px;color:var(--text-dim);margin-top:4px"></div>`;
        const $ = s => body.querySelector(s);
        let alive = true, busy = false;
        const cwd = () => (window.term ? window.term.lastCwd : undefined);

        const detectFw = async (c) => {
            const r = await window.dyo.fs.read(c + "/package.json", 200000).catch(() => null);
            if (r && r.content) {
                try {
                    const pkg = JSON.parse(r.content);
                    const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
                    for (const f of ["vitest", "jest", "mocha", "jasmine", "ava", "playwright", "@playwright/test", "cypress"]) {
                        if (deps[f]) return f.replace("@playwright/test", "playwright");
                    }
                    if (pkg.scripts && pkg.scripts.test) return "npm test";
                } catch (e) { /* ignore */ }
            }
            // non-JS hints
            const ls = await window.dyo.fs.list(c).catch(() => null);
            if (Array.isArray(ls)) {
                const names = ls.map(x => x.name);
                if (names.includes("pytest.ini") || names.includes("conftest.py")) return "pytest";
                if (names.includes("go.mod")) return "go test";
                if (names.includes("Cargo.toml")) return "cargo test";
                if (names.includes("pom.xml")) return "junit/maven";
            }
            return "unknown";
        };

        const tick = async () => {
            if (!alive || busy) return;
            busy = true;
            try {
                const c = cwd();
                if (!c) { $("#_tt_fw").textContent = "—"; $("#_tt_n").textContent = "—"; $("#_tt_list").textContent = "No project folder"; return; }
                const [fw, res] = await Promise.all([
                    detectFw(c),
                    window.dyo.exec("find", [".", "-type", "f", "(", "-name", "*test*", "-o", "-name", "*spec*", "-o", "-name", "*_test.go", ")", "-not", "-path", "*/node_modules/*", "-not", "-path", "*/.git/*"], { cwd: c, timeout: 8000 })
                ]);
                $("#_tt_fw").textContent = fw;
                $("#_tt_fw").style.color = fw === "unknown" ? "var(--text-dim)" : "var(--accent)";
                const files = (res && res.stdout ? res.stdout.split("\n") : []).filter(l => l.trim());
                $("#_tt_n").textContent = files.length ? String(files.length) : "0";
                if (!files.length) {
                    $("#_tt_list").textContent = "no test/spec files found";
                } else {
                    $("#_tt_list").innerHTML = files.slice(0, 60).map(f => `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(f.replace(/^\.\//, ""))}</div>`).join("");
                }
            } catch (e) {
                $("#_tt_list").textContent = "detection error";
            } finally { busy = false; }
        };
        tick();
        const iv = setInterval(tick, 10000);
        return { destroy: () => { alive = false; clearInterval(iv); } };
    }
};
