import WebSocket from "ws";
const base = "http://127.0.0.1:9222";
let list;
try { list = await (await fetch(base + "/json")).json(); }
catch (e) { console.log("cannot reach :9222 —", e.message); process.exit(0); }
const t = list.find(x => x.type === "page" && (x.url||"").includes("index.html")) || list.find(x=>x.type==="page");
if (!t) { console.log("no page target; targets:", list.map(x=>x.type+":"+x.url).join(", ")); process.exit(0); }
const ws = new WebSocket(t.webSocketDebuggerUrl, { maxPayload: 64*1024*1024 });
let id=0; const pend=new Map();
const cdp=(m,p={})=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});ws.send(JSON.stringify({id:i,method:m,params:p}));setTimeout(()=>pend.has(i)&&(pend.delete(i),rej(new Error("timeout"))),8000);});
const ev=e=>cdp("Runtime.evaluate",{expression:`(async()=>{${e}})()`,returnByValue:true,awaitPromise:true}).then(r=>r.result?.value);
await new Promise((res,rej)=>{ws.on("open",res);ws.on("error",rej);});
ws.on("message",raw=>{const m=JSON.parse(raw);if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);m.error?p.rej(new Error(m.error.message)):p.res(m.result);}});
await cdp("Runtime.enable");
// READ-ONLY: only observe what the app already detected. Do NOT initiate any ssh.
console.log("appVersion:", await ev("return (window.dyo && window.dyo.appInfo) ? (await window.dyo.appInfo()).electron : 'n/a'"));
console.log("__monitorHost:", JSON.stringify(await ev("return window.__monitorHost")));
console.log("hasFix (st.degraded in apwidget):", await ev("return typeof window.APWidget!=='undefined'"));
const badges = await ev(`return [...document.querySelectorAll('.apw-host')].map(e=>e.textContent).filter(Boolean)`);
console.log("host badges:", JSON.stringify(badges));
const statuses = await ev(`return [...document.querySelectorAll('.apw-status')].map(e=>e.textContent).filter(Boolean)`);
console.log("widget statuses:", JSON.stringify(statuses));
ws.close(); process.exit(0);
