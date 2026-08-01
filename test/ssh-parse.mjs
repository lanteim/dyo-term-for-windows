// Unit tests for SSH detection parsing + remote /proc collectors (no network).
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const require = createRequire(import.meta.url);
const dir = path.dirname(fileURLToPath(import.meta.url));
const { parseSshCommand } = require("../src/main/sshdetect.js");

// Load the browser-global APRemote with a window shim.
global.window = {};
new Function(fs.readFileSync(path.join(dir, "../src/renderer/core/apremote.js"), "utf8"))();
const AR = global.window.APRemote;
const P = AR._parse;

let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); (ok ? pass++ : fail++); if (!ok) console.log(`  FAIL ${name}\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`); else console.log(`  ok   ${name}`); };
const ok = (name, cond, d = "") => { (cond ? pass++ : fail++); console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${d ? " (" + d + ")" : ""}`); };

console.log("== parseSshCommand ==");
eq("plain user@host", parseSshCommand("ssh deploy@10.0.0.5"), { args: [], dest: "deploy@10.0.0.5", label: "10.0.0.5" });
eq("alias", parseSshCommand("ssh prod-web"), { args: [], dest: "prod-web", label: "prod-web" });
eq("with -p and -i", parseSshCommand("ssh -p 2222 -i ~/.ssh/id_ed25519 root@server"), { args: ["-p", "2222", "-i", "~/.ssh/id_ed25519"], dest: "root@server", label: "server" });
eq("drops -t and remote cmd", parseSshCommand("ssh -t user@box htop"), { args: [], dest: "user@box", label: "box" });
eq("keeps -o, drops -L", parseSshCommand("ssh -o StrictHostKeyChecking=no -L 8080:localhost:80 h"), { args: ["-o", "StrictHostKeyChecking=no"], dest: "h", label: "h" });
eq("full path ssh", parseSshCommand("/usr/bin/ssh box"), { args: [], dest: "box", label: "box" });
ok("not ssh -> null", parseSshCommand("sshd -D") === null);
ok("scp -> null", parseSshCommand("scp a b:c") === null);
ok("bare ssh -> null", parseSshCommand("ssh") === null);

console.log("== parseMeminfo ==");
const mem = P.parseMeminfo(`MemTotal: 16384000 kB
MemFree: 2048000 kB
MemAvailable: 8192000 kB
Buffers: 512000 kB
Cached: 4096000 kB
SReclaimable: 256000 kB
SwapTotal: 2048000 kB
SwapFree: 1024000 kB`);
ok("mem total", mem.total === 16384000 * 1024, mem.total);
ok("mem used = total-available", mem.used === (16384000 - 8192000) * 1024, mem.used);
ok("mem cached = Cached+SReclaimable", mem.cached === (4096000 + 256000) * 1024);
ok("swap used", mem.swapUsed === (2048000 - 1024000) * 1024);

console.log("== parseNetDev ==");
const nd = P.parseNetDev(`Inter-|   Receive
 face |bytes packets errs drop fifo frame compressed multicast|bytes packets errs
    lo: 100 1 0 0 0 0 0 0 100 1 0 0 0 0 0 0
  eth0: 1000000 100 2 0 0 0 0 0 500000 90 1 0 0 0 0 0`);
ok("skips lo", nd.length === 1 && nd[0].iface === "eth0");
ok("rx/tx bytes + errs", nd[0].rxBytes === 1000000 && nd[0].txBytes === 500000 && nd[0].rxErr === 2 && nd[0].txErr === 1, JSON.stringify(nd[0]));

console.log("== parseDf / parseInodes ==");
const df = P.parseDf(`Filesystem 1B-blocks Used Available Use% Mounted on
/dev/sda1 50000000000 30000000000 20000000000 60% /`);
ok("df row", df.length === 1 && df[0].size === 50000000000 && df[0].usePct === 60 && df[0].mount === "/", JSON.stringify(df[0]));
const ino = P.parseInodes(`Filesystem Inodes IUsed IFree IUse% Mounted on
/dev/sda1 3000000 900000 2100000 30% /`);
ok("inode pct by mount", ino["/"] === 30, JSON.stringify(ino));

console.log("== parseDiskstats ==");
const ds = P.parseDiskstats(`   8 0 sda 1000 0 20000 500 800 0 16000 400 0 300 900
   8 1 sda1 5 0 40 1 2 0 8 1 0 3 4
 253 0 dm-0 1 2 3 4 5 6 7 8 9 10 11`);
ok("diskstats sums whole disks only", ds.ios === 1800 && ds.readBytes === 20000 * 512 && ds.writeBytes === 16000 * 512, JSON.stringify(ds));

console.log("== APRemote.cpu (two samples → %) ==");
const stat1 = `cpu  1000 0 500 8000 200 0 50 0
cpu0 500 0 250 4000 100 0 25 0
cpu1 500 0 250 4000 100 0 25 0
@@LOAD
0.50 0.40 0.30 1/234 5678
@@NPROC
2
@@PROCS
 12.5 101 nginx
  8.0 202 postgres`;
const stat2 = `cpu  1100 0 550 8100 210 0 55 0
cpu0 550 0 275 4050 105 0 27 0
cpu1 550 0 275 4050 105 0 28 0
@@LOAD
0.60 0.40 0.30 1/234 5678
@@NPROC
2
@@PROCS
 20.0 101 nginx`;
const seq = [stat1, stat2];
let call = 0;
const ctx = { _r: {}, sh: async () => ({ code: 0, stdout: seq[Math.min(call++, seq.length - 1)] }) };
const c1 = await AR.cpu(ctx); // first sample: no prev → ~0
const c2 = await AR.cpu(ctx); // second: real delta
ok("cpu first sample ~0", c1.total === 0, c1.total);
ok("cpu second sample ~58%", c2.total > 50 && c2.total < 66, c2.total.toFixed(1));
ok("cpu cores parsed", c2.cores.length === 2);
ok("cpu top procs parsed", c2.procs[0].name === "nginx" && c2.procs[0].cpu === 20);
ok("cpu loadavg", c2.avg === 0.6);

console.log("== APRemote.net (two samples → rate) ==");
const nctx = { _r: {} };
let ncall = 0;
const nseq = [
    `  eth0: 1000000 1 0 0 0 0 0 0 2000000 1 0 0 0 0 0 0\n@@CONNS\n12`,
    `  eth0: 1500000 1 0 0 0 0 0 0 2400000 1 0 0 0 0 0 0\n@@CONNS\n12`,
];
nctx.sh = async () => ({ code: 0, stdout: nseq[Math.min(ncall++, 1)] });
const n1 = await AR.net(nctx);
await new Promise(r => setTimeout(r, 20)); // real code samples ~2s apart; give dt>0
const n2 = await AR.net(nctx);
ok("net first rate 0", n1.rxSec === 0);
ok("net rx rate > 0", n2.rxSec > 0 && n2.txSec > 0, `rx=${Math.round(n2.rxSec)} tx=${Math.round(n2.txSec)}`);
ok("net conns = 10", n2.conns === 10);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILED"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
