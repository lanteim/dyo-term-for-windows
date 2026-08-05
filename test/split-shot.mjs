import { spawn, execSync } from "node:child_process"; import fs from "node:fs"; import path from "node:path"; import WebSocket from "ws";
const appDir="/Users/lantis/cmd-pont/dyo-term"; const ud=path.join(appDir,".smoke","split-ud"); fs.rmSync(ud,{recursive:true,force:true}); fs.mkdirSync(ud,{recursive:true});
const app=spawn(path.join(appDir,"node_modules",".bin","electron"),[".","--remote-debugging-port=9401"],{cwd:appDir,env:{...process.env,DYOTERM_USER_DATA:ud,DYOTERM_BACKGROUND:"1",DYOTERM_NO_WEBGL:"1"},stdio:["ignore","ignore","ignore"]});
const delay=ms=>new Promise(r=>setTimeout(r,ms)); let ws,id=0; const pend=new Map();
const cdp=(m,p={})=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});ws.send(JSON.stringify({id:i,method:m,params:p}));setTimeout(()=>pend.has(i)&&(pend.delete(i),rej(new Error("t"))),15000);});
const ev=(e,a=false)=>cdp("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:a}).then(r=>{if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;});
try{let t=null;for(let i=0;i<40&&!t;i++){try{const l=await(await fetch("http://127.0.0.1:9401/json/list")).json();t=l.find(x=>x.type==="page"&&(x.url||"").includes("index.html"));}catch(e){}await delay(700);}
ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise((res,rej)=>{ws.on("open",res);ws.on("error",rej);});
ws.on("message",raw=>{const m=JSON.parse(raw);if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);m.error?p.rej(new Error(m.error.message)):p.res(m.result);}});
await cdp("Runtime.enable");
for(let i=0;i<30;i++){if(await ev("!!(window.term&&window.term.activeTab())"))break;await delay(400);}
await delay(1500);
// collapse dashboard for full-width terminals, then create 6 splits (7 panes) mixing directions
await ev(`document.getElementById("dash-btn").click()`);
await delay(300);
await ev(`window.term.splitFocused("vertical")`); await delay(250);
await ev(`window.term.splitFocused("horizontal")`); await delay(250);
await ev(`(()=>{const t=window.term.activeTab();window.term.focusPane(t.panes()[0]);})()`); await delay(150);
await ev(`window.term.splitFocused("horizontal")`); await delay(250);
await ev(`window.term.splitFocused("vertical")`); await delay(250);
await ev(`(()=>{const t=window.term.activeTab();window.term.focusPane(t.panes()[t.panes().length-1]);})()`); await delay(150);
await ev(`window.term.splitFocused("vertical")`); await delay(250);
await delay(1200);
const n=await ev(`window.term.activeTab().panes().length`);
console.log("panes:",n);
const shot=await cdp("Page.captureScreenshot",{format:"png"});
fs.writeFileSync(path.join(appDir,".smoke","splits.png"),Buffer.from(shot.data,"base64"));
console.log("wrote .smoke/splits.png");
}catch(e){console.error("err",e.message);}finally{try{await ev(`window.dyo.win("close")`);}catch(e){}await delay(600);try{app.kill("SIGKILL");}catch(e){}try{execSync('pkill -9 -f \"remote-debugging-port=9401"');}catch(e){}process.exit(0);}
