"use strict";
// Remote metric collectors for A.Petrov widgets. When a widget is "remote"
// (its active tab is ssh'd somewhere), it calls these instead of the local
// systeminformation path. Each collector runs ONE shell command on the remote
// host via ctx.sh() and parses standard Linux /proc + coreutils output. Rates
// (cpu%, net, disk IO) are computed from the previous sample cached on ctx._r.
//
// Pure parsers are exported on window.APRemote for unit testing (test/ssh-parse).

(function () {
    const N = s => { const n = parseFloat(s); return isFinite(n) ? n : 0; };
    // split a marked payload ("...@@KEY\n...") into { KEY: "section text" }
    function sections(text, first) {
        const out = {}; let cur = first || "_";
        String(text || "").split("\n").forEach(line => {
            const m = line.match(/^@@([A-Z]+)$/);
            if (m) { cur = m[1]; out[cur] = out[cur] || ""; }
            else out[cur] = (out[cur] || "") + line + "\n";
        });
        return out;
    }
    const prev = (ctx, key) => (ctx._r || (ctx._r = {}))[key];
    const store = (ctx, key, val) => { (ctx._r || (ctx._r = {}))[key] = val; };
    // Surface the real ssh failure (auth/timeout/host key) instead of a blank.
    const sshErr = r => {
        if (!r) return "no response";
        const line = String(r.stderr || "").split("\n").map(s => s.trim()).filter(Boolean).pop();
        return line || ("ssh exit " + (r.code != null ? r.code : "?"));
    };
    const fail = async (ctx, cmd) => {
        const r = await ctx.sh(cmd, { timeout: 9000 });
        if (!r || r.code !== 0) return { r, err: { error: sshErr(r) } };
        if (!String(r.stdout || "").trim()) return { r, err: { error: "empty response (is this Linux with /proc?)" } };
        return { r, err: null };
    };

    // ---------- CPU ----------
    function parseStat(txt) {
        const cpus = {}; // name -> {total, idle}
        String(txt).split("\n").forEach(l => {
            const m = l.match(/^(cpu\d*)\s+(.+)$/);
            if (!m) return;
            const nums = m[2].trim().split(/\s+/).map(N);
            const idle = (nums[3] || 0) + (nums[4] || 0); // idle + iowait
            const total = nums.reduce((a, b) => a + b, 0);
            cpus[m[1]] = { total, idle };
        });
        return cpus;
    }
    async function cpu(ctx) {
        const cmd = 'cat /proc/stat 2>/dev/null; echo "@@LOAD"; cat /proc/loadavg 2>/dev/null; echo "@@NPROC"; nproc 2>/dev/null; echo "@@PROCS"; ps -eo pcpu=,pid=,comm= 2>/dev/null | sort -rn | head -n 8';
        const { r, err } = await fail(ctx, cmd);
        if (err) return err;
        const sec = sections(r.stdout, "STAT");
        const cur = parseStat(sec.STAT);
        const last = prev(ctx, "cpu"); store(ctx, "cpu", cur);
        const pct = name => {
            if (!last || !last[name] || !cur[name]) return 0;
            const dt = cur[name].total - last[name].total, di = cur[name].idle - last[name].idle;
            return dt > 0 ? Math.max(0, Math.min(100, (1 - di / dt) * 100)) : 0;
        };
        const cores = Object.keys(cur).filter(k => k !== "cpu").sort().map(k => ({ load: pct(k) }));
        const load = (sec.LOAD || "").trim().split(/\s+/).map(N);
        const procs = (sec.PROCS || "").trim().split("\n").filter(Boolean).map(l => {
            const p = l.trim().split(/\s+/); return { cpu: N(p[0]), pid: p[1], name: p.slice(2).join(" ") };
        });
        return { total: pct("cpu"), cores, avg: load[0] || 0, nproc: N((sec.NPROC || "").trim()) || cores.length, procs };
    }

    // ---------- Memory ----------
    function parseMeminfo(txt) {
        const kv = {};
        String(txt).split("\n").forEach(l => { const m = l.match(/^(\w+):\s+(\d+)/); if (m) kv[m[1]] = N(m[2]) * 1024; });
        const cached = (kv.Cached || 0) + (kv.SReclaimable || 0);
        return {
            total: kv.MemTotal || 0,
            free: kv.MemFree || 0,
            available: kv.MemAvailable != null ? kv.MemAvailable : (kv.MemFree || 0) + (kv.Buffers || 0) + cached,
            buffers: kv.Buffers || 0,
            cached,
            used: (kv.MemTotal || 0) - (kv.MemAvailable != null ? kv.MemAvailable : (kv.MemFree || 0)),
            swapTotal: kv.SwapTotal || 0,
            swapUsed: (kv.SwapTotal || 0) - (kv.SwapFree || 0),
        };
    }
    async function mem(ctx) {
        const cmd = 'cat /proc/meminfo 2>/dev/null; echo "@@PROCS"; ps -eo rss=,pid=,comm= 2>/dev/null | sort -rn | head -n 8';
        const { r, err } = await fail(ctx, cmd);
        if (err) return err;
        const sec = sections(r.stdout, "MEM");
        const m = parseMeminfo(sec.MEM);
        m.procs = (sec.PROCS || "").trim().split("\n").filter(Boolean).map(l => {
            const p = l.trim().split(/\s+/); return { rss: N(p[0]) * 1024, pid: p[1], name: p.slice(2).join(" ") };
        });
        return m;
    }

    // ---------- Network ----------
    function parseNetDev(txt) {
        const ifaces = [];
        String(txt).split("\n").forEach(l => {
            const m = l.match(/^\s*([^:]+):\s*(.+)$/);
            if (!m) return;
            const name = m[1].trim(); const f = m[2].trim().split(/\s+/).map(N);
            if (name === "lo") return;
            ifaces.push({ iface: name, rxBytes: f[0] || 0, rxErr: f[2] || 0, txBytes: f[8] || 0, txErr: f[10] || 0 });
        });
        return ifaces;
    }
    async function net(ctx) {
        const cmd = 'cat /proc/net/dev 2>/dev/null; echo "@@CONNS"; cat /proc/net/tcp /proc/net/tcp6 2>/dev/null | wc -l';
        const { r, err } = await fail(ctx, cmd);
        if (err) return err;
        const sec = sections(r.stdout, "DEV");
        const ifaces = parseNetDev(sec.DEV);
        // primary = iface with most total bytes
        const primary = ifaces.slice().sort((a, b) => (b.rxBytes + b.txBytes) - (a.rxBytes + a.txBytes))[0] || { iface: "-", rxBytes: 0, txBytes: 0, rxErr: 0, txErr: 0 };
        const now = Date.now(); const last = prev(ctx, "net");
        store(ctx, "net", { t: now, rx: primary.rxBytes, tx: primary.txBytes });
        let rxSec = 0, txSec = 0;
        if (last && last.t) { const dt = (now - last.t) / 1000; if (dt > 0) { rxSec = Math.max(0, (primary.rxBytes - last.rx) / dt); txSec = Math.max(0, (primary.txBytes - last.tx) / dt); } }
        const conns = Math.max(0, N((sec.CONNS || "").trim()) - 2); // minus the two header lines
        return { iface: primary.iface, rxSec, txSec, rxBytes: primary.rxBytes, txBytes: primary.txBytes, rxErr: primary.rxErr, txErr: primary.txErr, conns, ifaces };
    }

    // ---------- Disk ----------
    function parseDf(txt) {
        const rows = [];
        String(txt).split("\n").slice(1).forEach(l => {
            const p = l.trim().split(/\s+/);
            if (p.length < 6) return;
            rows.push({ fs: p[0], size: N(p[1]), used: N(p[2]), usePct: N(p[4]), mount: p.slice(5).join(" ") });
        });
        return rows;
    }
    function parseInodes(txt) {
        const map = {};
        String(txt).split("\n").slice(1).forEach(l => {
            const p = l.trim().split(/\s+/);
            if (p.length < 6) return;
            map[p.slice(5).join(" ")] = N(p[4]);
        });
        return map;
    }
    function parseDiskstats(txt) {
        let reads = 0, writes = 0, rSec = 0, wSec = 0;
        String(txt).split("\n").forEach(l => {
            const p = l.trim().split(/\s+/);
            if (p.length < 14) return;
            const name = p[2];
            if (/^(loop|ram|dm-|sr|fd)/.test(name)) return;
            if (/\d$/.test(name) && /^(sd|vd|nvme|xvd)/.test(name) && !/nvme\d+n\d+$/.test(name)) return; // skip partitions, keep whole disks
            reads += N(p[3]); writes += N(p[7]); rSec += N(p[5]); wSec += N(p[9]);
        });
        return { ios: reads + writes, readBytes: rSec * 512, writeBytes: wSec * 512 };
    }
    async function disk(ctx) {
        const cmd = 'df -B1 -x tmpfs -x devtmpfs -x overlay -x squashfs 2>/dev/null; echo "@@INODES"; df -iP 2>/dev/null; echo "@@IO"; cat /proc/diskstats 2>/dev/null';
        const { r, err } = await fail(ctx, cmd);
        if (err) return err;
        const sec = sections(r.stdout, "DF");
        const fs = parseDf(sec.DF);
        const inodes = parseInodes(sec.INODES);
        fs.forEach(x => { x.inodePct = inodes[x.mount] != null ? inodes[x.mount] : null; });
        const io = parseDiskstats(sec.IO);
        const now = Date.now(); const last = prev(ctx, "disk");
        store(ctx, "disk", { t: now, ios: io.ios, r: io.readBytes, w: io.writeBytes });
        let iops = 0, readSec = 0, writeSec = 0;
        if (last && last.t) { const dt = (now - last.t) / 1000; if (dt > 0) { iops = Math.max(0, (io.ios - last.ios) / dt); readSec = Math.max(0, (io.readBytes - last.r) / dt); writeSec = Math.max(0, (io.writeBytes - last.w) / dt); } }
        return { fs, iops, readSec, writeSec };
    }

    // ---------- System ----------
    async function system(ctx) {
        const cmd = [
            'cat /proc/uptime 2>/dev/null', 'echo "@@LOAD"', 'cat /proc/loadavg 2>/dev/null',
            'echo "@@NPROC"', 'nproc 2>/dev/null', 'echo "@@HOST"', 'hostname 2>/dev/null',
            'echo "@@KERNEL"', 'uname -sr 2>/dev/null', 'echo "@@ARCH"', 'uname -m 2>/dev/null',
            'echo "@@OS"', '(. /etc/os-release 2>/dev/null; echo "$PRETTY_NAME")',
            'echo "@@PROCS"', 'ps -e 2>/dev/null | tail -n +2 | wc -l', 'echo "@@USERS"', 'who 2>/dev/null | wc -l'
        ].join("; ");
        const { r, err } = await fail(ctx, cmd);
        if (err) return err;
        const s = sections(r.stdout, "UP");
        const load = (s.LOAD || "").trim().split(/\s+/).map(N);
        return {
            uptime: N((s.UP || "").trim().split(/\s+/)[0]),
            load: [load[0] || 0, load[1] || 0, load[2] || 0],
            nproc: N((s.NPROC || "").trim()),
            hostname: (s.HOST || "").trim(),
            kernel: (s.KERNEL || "").trim(),
            arch: (s.ARCH || "").trim(),
            os: (s.OS || "").trim(),
            procs: N((s.PROCS || "").trim()),
            users: N((s.USERS || "").trim()),
        };
    }

    window.APRemote = {
        cpu, mem, net, disk, system,
        // exported for tests
        _parse: { parseStat, parseMeminfo, parseNetDev, parseDf, parseInodes, parseDiskstats, sections },
    };
})();
