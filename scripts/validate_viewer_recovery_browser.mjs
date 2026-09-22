// Browser-local faults only: no service writes or contribution submissions.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const [endpoint,target,output]=process.argv.slice(2);
if(!endpoint||!target||!output)throw Error('Usage: CDP_URL PREVIEW_URL OUTPUT');
await mkdir(output,{recursive:true});
const pages=await(await fetch(endpoint+'/json/list')).json();
const ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>ws.onopen=resolve);
let seq=0;const jobs=new Map(),errors=[],passed=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const job=jobs.get(m.id);jobs.delete(m.id);m.error?job.reject(m.error):job.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);};
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;jobs.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async expression=>{for(let i=0;i<200;i++){if(await ev(expression))return;await sleep(100);}throw Error('Timeout: '+expression);};
const click=async selector=>{await ev(`document.querySelector(${JSON.stringify(selector)}).click()`);await sleep(180);};
const shot=async name=>{await sleep(400);await writeFile(`${output}/${name}.png`,Buffer.from((await call('Page.captureScreenshot')).data,'base64'));};
const size=async(width,height=1000)=>{await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<760});await sleep(300);};
const search=async value=>{await ev(`(()=>{const el=document.querySelector('#tooth-search');el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input'));})()`);};
let injection;
async function inject(source){
 if(injection)await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:injection});
 injection=source?(await call('Page.addScriptToEvaluateOnNewDocument',{source})).identifier:undefined;
}
try{
 await call('Runtime.enable');await call('Page.enable');await size(1400);
 await call('Page.navigate',{url:target});await wait('window.__anatomy?.snapshot().frames>0');passed.push('normal Chromium loads source atlas');
 await call('Page.navigate',{url:new URL('/?graphics=compat',target).href});await wait('window.__anatomy?.snapshot().frames>0');
 assert.equal(await ev('document.querySelector("canvas").getContext("webgl2").getContextAttributes().antialias'),false);
 assert.equal(await ev('__anatomy.snapshot().teeth'),28);await shot('compatible-atlas');passed.push('compatible profile preserves 28 source teeth');
 await inject(`const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,options){if(type==='webgl2'&&options?.antialias)return null;return original.call(this,type,options);};`);
 await call('Page.navigate',{url:target});await wait('window.__anatomy?.snapshot().frames>0');
 assert.equal(await ev('document.querySelector("canvas").getContext("webgl2").getContextAttributes().antialias'),false);
 assert.ok(await ev('document.querySelector(".graphics-notice")?.textContent.includes("Uyumlu")'));passed.push('rejected antialias automatically falls back');
 await inject(`const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,options){if(type==='webgl2')return null;return original.call(this,type,options);};`);
 await call('Page.navigate',{url:target});await wait('document.querySelector("#loading")?.dataset.errorCode==="GRAPHICS_CONTEXT_FAILED"');
 assert.ok(await ev('document.querySelector("#loading details").textContent.includes("WebGL")'));
 assert.equal(await ev('document.querySelector("#retry-model").disabled'),false);await shot('blocked-webgl');passed.push('blocked graphics reports actual cause and recovery actions');
 await inject(`const original=window.fetch;window.fetch=function(input,...args){if(String(input).endsWith('/dentition.bin'))return Promise.resolve(new Response('',{status:503}));return original.call(this,input,...args);};`);
 await call('Page.navigate',{url:target});await wait('document.querySelector("#loading")?.dataset.errorCode==="MODEL_FILES_FAILED"');
 assert.ok(await ev('document.querySelector("#loading p").textContent.includes("dosyaları")'));
 assert.equal(await ev('!!document.querySelector(".error-compatible")'),false);passed.push('file failure does not blame graphics');
 await inject('');await call('Page.navigate',{url:new URL('/tooth-interior?graphics=compat',target).href});await wait('window.__interior?.snapshot().frames>0');await click('[data-step=section]');
 assert.equal(await ev('document.querySelector("canvas").getContext("webgl2").getContextAttributes().stencil'),true);
 assert.equal(await ev('__interior.snapshot().layers.filter(x=>x.cap).length'),2);await shot('compatible-section');passed.push('compatible interior retains stencil section caps');
 assert.deepEqual(errors,[]);passed.push('no uncaught runtime exceptions');
 await writeFile(`${output}/result.json`,JSON.stringify({passed,errors},null,2));console.log(JSON.stringify({passed,errors}));
}finally{if(injection)await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:injection});ws.close();}
