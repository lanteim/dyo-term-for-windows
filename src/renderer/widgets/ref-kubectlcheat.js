"use strict";
window.I18N.register({
    en: { "widget.ref_kubectlcheat": "kubectl Cheat-Sheet", "cat.reference": "Reference" },
    ru: { "widget.ref_kubectlcheat": "kubectl шпаргалка", "cat.reference": "Справочник" }
});
window.WIDGETS = window.WIDGETS || {};

window.WIDGETS.ref_kubectlcheat = {
    id: "ref_kubectlcheat",
    title: "widget.ref_kubectlcheat",
    category: "reference",
    description: "kubectl cheat-sheet, searchable; click to copy",
    defaultSize: { w: 8, h: 5 },
    mount(body) {
        const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
        const DATA = [
            ["Context", [
                ["kubectl config get-contexts", "List contexts"],
                ["kubectl config use-context <ctx>", "Switch context"],
                ["kubectl config set-context --current --namespace=<ns>", "Set default namespace"],
                ["kubectl cluster-info", "Show cluster endpoints"]
            ]],
            ["Get / inspect", [
                ["kubectl get pods -A", "All pods in all namespaces"],
                ["kubectl get pods -o wide", "Pods with node & IP"],
                ["kubectl get svc,deploy,ingress", "Multiple resource types"],
                ["kubectl describe pod <name>", "Detailed pod info & events"],
                ["kubectl get events --sort-by=.lastTimestamp", "Recent events"],
                ["kubectl get pod <name> -o yaml", "Full manifest as YAML"],
                ["kubectl top pods", "Pod CPU/memory usage"]
            ]],
            ["Logs & exec", [
                ["kubectl logs <pod>", "Show pod logs"],
                ["kubectl logs -f <pod>", "Follow logs"],
                ["kubectl logs <pod> -c <container>", "Logs of a container"],
                ["kubectl logs --previous <pod>", "Logs of the crashed instance"],
                ["kubectl exec -it <pod> -- sh", "Shell into a pod"],
                ["kubectl port-forward svc/<svc> 8080:80", "Forward a local port"]
            ]],
            ["Apply / delete", [
                ["kubectl apply -f file.yaml", "Apply a manifest"],
                ["kubectl delete -f file.yaml", "Delete from manifest"],
                ["kubectl delete pod <name>", "Delete a pod"],
                ["kubectl rollout restart deploy/<name>", "Restart a deployment"],
                ["kubectl rollout status deploy/<name>", "Watch rollout progress"],
                ["kubectl rollout undo deploy/<name>", "Roll back a deployment"]
            ]],
            ["Scale & edit", [
                ["kubectl scale deploy/<name> --replicas=3", "Scale a deployment"],
                ["kubectl set image deploy/<name> app=img:tag", "Update container image"],
                ["kubectl edit deploy/<name>", "Edit a resource live"],
                ["kubectl label pod <name> key=val", "Add a label"]
            ]],
            ["Debug", [
                ["kubectl get pods --field-selector=status.phase!=Running", "Non-running pods"],
                ["kubectl explain pod.spec", "Docs for a field"],
                ["kubectl api-resources", "List resource types"],
                ["kubectl auth can-i create pods", "Check RBAC permission"]
            ]]
        ];
        window.__refCheatRender(body, DATA, esc, "Search kubectl commands…");
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
