"use strict";
window.I18N.register({
    en: { "widget.ref_dockercheat": "Docker Cheat-Sheet", "cat.reference": "Reference" },
    ru: { "widget.ref_dockercheat": "Docker шпаргалка", "cat.reference": "Справочник" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.ref_dockercheat = {
    id: "ref_dockercheat",
    title: "widget.ref_dockercheat",
    category: "reference",
    description: "Docker cheat-sheet, searchable; click to copy",
    defaultSize: { w: 8, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const DATA = [
            ["Containers", [
                ["docker ps", "List running containers"],
                ["docker ps -a", "List all containers"],
                ["docker run -it --rm image sh", "Run interactive, auto-remove"],
                ["docker run -d -p 8080:80 image", "Run detached with port map"],
                ["docker exec -it <id> sh", "Shell into a container"],
                ["docker stop <id>", "Stop a container"],
                ["docker rm <id>", "Remove a container"],
                ["docker logs -f <id>", "Follow container logs"]
            ]],
            ["Images", [
                ["docker images", "List local images"],
                ["docker build -t name:tag .", "Build an image"],
                ["docker pull image:tag", "Pull an image"],
                ["docker push name:tag", "Push an image"],
                ["docker tag src name:tag", "Tag an image"],
                ["docker rmi <image>", "Remove an image"],
                ["docker history <image>", "Show image layers"]
            ]],
            ["Compose", [
                ["docker compose up -d", "Start services detached"],
                ["docker compose down", "Stop and remove services"],
                ["docker compose ps", "List compose services"],
                ["docker compose logs -f", "Follow all service logs"],
                ["docker compose build", "Build service images"],
                ["docker compose restart <svc>", "Restart a service"]
            ]],
            ["Inspect & network", [
                ["docker inspect <id>", "Full JSON details"],
                ["docker stats", "Live resource usage"],
                ["docker top <id>", "Processes in a container"],
                ["docker network ls", "List networks"],
                ["docker cp <id>:/path ./local", "Copy files out of a container"]
            ]],
            ["Volumes & prune", [
                ["docker volume ls", "List volumes"],
                ["docker volume prune", "Remove unused volumes"],
                ["docker system df", "Disk usage summary"],
                ["docker system prune -a", "Remove unused data & images"],
                ["docker builder prune", "Clean build cache"]
            ]]
        ];
        window.__refCheatRender(body, DATA, esc, "Search docker commands…");
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
