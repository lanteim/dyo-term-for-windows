"use strict";
// Detect an interactive `ssh` session running under a pty and extract the
// connection so widgets can run metric commands on the SAME remote host.
// Pure parser (parseSshCommand) is unit-tested from fixtures; detectSshUnderPid
// walks the process tree via `ps` (macOS/Linux).
const { execFileSync } = require("child_process");

// ssh options that consume a following argument
const TAKES_ARG = new Set(["-B", "-b", "-c", "-D", "-E", "-e", "-F", "-I", "-i", "-J", "-L", "-l", "-m", "-O", "-o", "-P", "-p", "-Q", "-R", "-S", "-W", "-w"]);
// connection options safe to reuse for a background, non-interactive command
const KEEP = new Set(["-p", "-i", "-l", "-o", "-F", "-J", "-c", "-C", "-4", "-6"]);
const KEEP_ARG = new Set(["-p", "-i", "-l", "-o", "-F", "-J", "-c"]);

// Parse a full `ssh …` command line → { args:[reusable conn opts], dest, label } | null
function parseSshCommand(cmd) {
    if (!cmd) return null;
    const toks = String(cmd).trim().split(/\s+/);
    const base = (toks[0] || "").split("/").pop();
    if (base !== "ssh") return null;
    toks.shift();

    const conn = [];
    let dest = null;
    for (let i = 0; i < toks.length && dest == null; i++) {
        const t = toks[i];
        if (t.startsWith("-")) {
            const flag = t.slice(0, 2);
            if (flag === "-W" || flag === "-O") return null; // stdio proxy / mux control → not an interactive session
            conn.push(t);
            if (TAKES_ARG.has(flag) && t.length === 2 && toks[i + 1] != null) conn.push(toks[++i]);
        } else {
            dest = t; // first bare operand is the destination
            if (i + 1 < toks.length) return null; // tokens after dest = remote command → non-interactive (git/rsync/scp)
        }
    }
    if (!dest) return null;

    // curate: keep only reusable connection options (drop -N/-f/-t/-L/-R/-D …)
    const args = [];
    for (let i = 0; i < conn.length; i++) {
        const t = conn[i];
        const flag = t.slice(0, 2);
        if (KEEP.has(flag)) {
            args.push(t);
            if (KEEP_ARG.has(flag) && t.length === 2 && conn[i + 1] != null && !conn[i + 1].startsWith("-")) args.push(conn[++i]);
        } else if (TAKES_ARG.has(flag) && t.length === 2 && conn[i + 1] != null && !conn[i + 1].startsWith("-")) {
            i++; // skip this dropped option's separate argument
        }
    }
    const label = dest.includes("@") ? dest.split("@").pop() : dest;
    return { args, dest, label };
}

// Find the ssh session under a pty's process tree (shallowest wins → the
// user's session, not proxy/mux children spawned under it).
function detectSshUnderPid(rootPid) {
    if (!rootPid) return null;
    let out;
    try { out = execFileSync("ps", ["-axo", "pid=,ppid=,command="], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }); }
    catch (e) { return null; }
    const kids = new Map(), cmd = new Map();
    out.split("\n").forEach(line => {
        const m = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);
        if (!m) return;
        const pid = +m[1], ppid = +m[2];
        cmd.set(pid, m[3]);
        (kids.get(ppid) || kids.set(ppid, []).get(ppid)).push(pid);
    });
    const q = [rootPid], seen = new Set();
    let found = null;
    while (q.length) {
        const p = q.shift();
        if (seen.has(p)) continue;
        seen.add(p);
        for (const c of (kids.get(p) || [])) {
            const parsed = parseSshCommand(cmd.get(c));
            if (parsed) { if (!found) found = parsed; continue; } // keep the shallowest match; do not descend into its children
            q.push(c);
        }
    }
    return found;
}

module.exports = { parseSshCommand, detectSshUnderPid };
