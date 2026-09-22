import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const [endpoint,target,output,keyFile]=process.argv.slice(2);
if(!endpoint||!target||!output||!keyFile)throw Error('Usage: endpoint target output test-admin-key-file (isolated test service only)');
if(new URL(target).hostname!=='127.0.0.1')throw Error('Synthetic submissions must use isolated localhost service');
await mkdir(output,{recursive:true});
const pages=await(await fetch(endpoint+'/json/list')).json();const page=pages.find(p=>p.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let seq=0;const pending=new Map(),errors=[],passed=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const wait=async expression=>{for(let i=0;i<300;i++){if(await ev(expression))return;await sleep(100);}throw Error('Timeout: '+expression);};
const click=selector=>ev(`document.querySelector(${JSON.stringify(selector)}).click()`);
const shot=async name=>writeFile(output+'/'+name+'.png',Buffer.from((await call('Page.captureScreenshot')).data,'base64'));
try{
await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await call('Page.navigate',{url:target});await wait('window.__anatomy && !document.querySelector("#contribute").disabled');
await click('#root-preset');await click('[data-fdi="36"]');await click('[data-view="side"]');await sleep(600);const original=await ev('__anatomy.captureView()');
await click('#contribute');await wait('document.querySelector("#contribution-dialog").open');
await ev(`document.querySelector('[name=description]').value='Synthetic observation: <img src=x onerror=alert(1)> roots relation';document.querySelector('[name=expected]').value='Synthetic browser validation only';document.querySelector('[name=evidence]').value='https://example.org/evidence';document.querySelector('[name=consent]').checked=true`);
await shot('contribution-form');await ev('document.querySelector("#contribution-form").requestSubmit()');await wait('document.querySelector("#contribution-dialog a[href*=contributions]")');passed.push('form creates durable receipt from selected FDI and exact view');
const tracking=await ev('document.querySelector("#contribution-dialog a[href*=contributions]").href');const params=new URLSearchParams(new URL(tracking).hash.slice(1));const id=params.get('id'),key=params.get('key');await shot('contribution-receipt');
await call('Page.navigate',{url:tracking});await wait('document.querySelector("#replay-view")');assert.equal(await ev('document.querySelectorAll("#contribution-tracking img").length'),0);assert.ok(await ev('document.body.textContent.includes("<img src=x")'));passed.push('fresh page tracks privately; hostile text remains text');
await ev(`document.querySelector('[name=note]').value='Synthetic additional evidence';document.querySelector('#contribution-tracking form').requestSubmit()`);await wait('document.body.textContent.includes("Sürüm: 1")');passed.push('contributor adds evidence with retained history');
const adminKey=(await readFile(keyFile,'utf8')).trim();const response=await fetch(new URL('/api/contributions/'+id+'/events',target),{method:'POST',headers:{Authorization:'Bearer '+adminKey,'Content-Type':'application/json','X-DKB-Request':'1'},body:JSON.stringify({revision:1,status:'triage',note:'Synthetic maintainer triage only',evidence:[]})});assert.equal(response.status,200);
await call('Page.reload');await wait('document.body.textContent.includes("Ön incelemede")');await shot('contribution-tracking');passed.push('authenticated maintainer status and timeline visible to contributor');
const replay=await ev('document.querySelector("#replay-view").href');await call('Page.navigate',{url:replay});await wait('document.querySelector(".contribution-toast")');const restored=await ev('__anatomy.captureView()');assert.deepEqual(restored.state,original.state);assert.deepEqual(restored.assets,original.assets);assert.equal(restored.structure,original.structure);for(const name of ['camera','target'])for(let i=0;i<3;i++)assert.ok(Math.abs(restored[name][i]-original[name][i])<.001,`${name} coordinate ${i}`);passed.push('tracking link restores source version, structure, camera, target and layers');await shot('restored-view');
await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await click('#contribute');await sleep(200);assert.ok(await ev('document.documentElement.scrollWidth<=innerWidth'));assert.ok(await ev('document.querySelector("#contribution-dialog").getBoundingClientRect().width<=innerWidth'));await shot('mobile-form');passed.push('mobile form fits viewport');
assert.deepEqual(errors,[]);passed.push('no browser runtime exceptions');await writeFile(output+'/result.json',JSON.stringify({passed,errors},null,2));console.log(JSON.stringify({passed,errors}));
}finally{ws.close();}
