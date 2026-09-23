// Run against an isolated preview; this suite never submits contributions.
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
try{
 await call('Runtime.enable');await call('Page.enable');await size(1600);
 await call('Page.navigate',{url:target});await wait('window.__anatomy?.snapshot().frames>0');
 assert.equal(await ev('document.documentElement.lang'),'en');
 assert.ok(await ev('document.querySelector("#tooth-name").textContent.includes("molar")'));
 await search('canine');assert.equal(await ev('document.querySelectorAll("#search-results button").length'),4);await search('');
 await shot('english-atlas');passed.push('English default and English anatomical search');
 await ev('document.querySelector("#language-select").value="tr";document.querySelector("#language-select").dispatchEvent(new Event("change"))');
 await wait('document.documentElement.lang==="tr" && window.__anatomy?.snapshot().frames>0');
 await search('kopek');assert.equal(await ev('document.querySelectorAll("#search-results button").length'),4);await search('');passed.push('Turkish selector and anatomical search');
 await call('Page.navigate',{url:new URL('/tooth-interior',target).href});await wait('window.__interior?.snapshot().frames>0');assert.equal(await ev('document.documentElement.lang'),'tr');passed.push('language persists across navigation');
 await ev('document.querySelector("#language-select").value="en";document.querySelector("#language-select").dispatchEvent(new Event("change"))');
 await wait('document.documentElement.lang==="en" && window.__interior?.snapshot().frames>0');await click('[data-step=section]');await shot('english-interior');
 for(const path of ['/','/tooth-interior','/overview','/contributions']){
  await call('Page.navigate',{url:new URL(path,target).href});await wait('document.querySelector("#language-select")');await sleep(1200);
  assert.equal(await ev('document.documentElement.lang'),'en');
  for(const width of [360,390,768,1024]){await size(width,844);assert.ok(await ev('document.documentElement.scrollWidth<=innerWidth'),path+' at '+width);}
 }
 passed.push('all English pages fit mobile and tablet widths');await shot('english-tracking-mobile');
 assert.deepEqual(errors,[]);passed.push('no browser runtime exceptions');console.log(JSON.stringify({passed,errors}));
 await writeFile(`${output}/result.json`,JSON.stringify({passed,errors},null,2));
}finally{ws.close();}
