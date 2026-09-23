// Read-only browser-local fault injection. Does not submit contributions.
import assert from 'node:assert/strict';
const [endpoint,target]=process.argv.slice(2);
const pages=await(await fetch(endpoint+'/json/list')).json();
const ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.onopen=r);let sequence=0;const pending=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const job=pending.get(m.id);pending.delete(m.id);clearTimeout(job.timer);m.error?job.reject(Error(JSON.stringify(m.error))):job.resolve(m.result);}};
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},30000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=async expression=>{for(let i=0;i<150;i++){if(await ev(expression))return;await new Promise(r=>setTimeout(r,200));}throw Error('Timed out: '+expression);};
let injection;
try{
 await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
 await call('Page.navigate',{url:target});await wait('window.__anatomy?.snapshot().frames>0');assert.equal(await ev('__anatomy.snapshot().teeth'),28);console.log('PASS: live atlas renders 28 teeth');
 await call('Network.setBlockedURLs',{urls:['*/anatomy.js']});await call('Page.navigate',{url:target});await wait('document.querySelector("#loading")?.dataset.errorCode==="MODEL_MODULE_FAILED"');assert.equal(await ev('!!document.querySelector("#retry-model")'),true);assert.equal(await ev('Array.from(document.querySelectorAll("#loading a")).some(a=>a.pathname==="/report")'),true);console.log('PASS: missing module shows recovery and independent report link');
 await call('Network.setBlockedURLs',{urls:[]});
 injection=(await call('Page.addScriptToEvaluateOnNewDocument',{source:`const originalFetch=window.fetch;window.fetch=(url,...args)=>String(url).endsWith('dentition.bin')?new Promise(()=>{}):originalFetch(url,...args);const originalTimer=window.setTimeout;window.setTimeout=(fn,ms,...args)=>originalTimer(fn,ms===45000?30:ms,...args);`})).identifier;
 await call('Page.navigate',{url:target});await wait('document.querySelector("#loading")?.dataset.errorCode==="MODEL_FILES_FAILED"');console.log('PASS: stalled transfer reaches file error instead of indefinite loading');
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:injection});injection=null;
 await call('Page.navigate',{url:target});await wait('window.__anatomy?.snapshot().frames>0');console.log('PASS: reload recovers after faults are removed');
}finally{
 if(injection)await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:injection});
 await call('Network.setBlockedURLs',{urls:[]});ws.close();
}
