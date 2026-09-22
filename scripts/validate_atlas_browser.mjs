import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const [,, endpoint='http://127.0.0.1:9222', target='http://192.168.1.192:3057/', output='/tmp/dkb-atlas-proof']=process.argv;
await mkdir(output,{recursive:true});
const pages=await (await fetch(endpoint+'/json/list')).json();const page=pages.find(p=>p.type==='page'&&p.url.startsWith(new URL(target).origin));
if(!page)throw new Error('Open the target in the debug Chrome instance first');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let seq=0;const pending=new Map(),errors=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async expr=>{for(let i=0;i<100;i++){if(await ev(expr))return;await sleep(100);}throw Error('Timeout: '+expr);};
const click=async selector=>{await ev(`document.querySelector(${JSON.stringify(selector)}).click()`);await sleep(100);};
const shot=async name=>writeFile(output+'/'+name+'.png',Buffer.from((await call('Page.captureScreenshot')).data,'base64'));
await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});await call('Page.navigate',{url:target});await wait('window.__atlas?.snapshot().frames>1');
assert.equal((await ev('__atlas.snapshot()')).visibleTeeth,32);await shot('mouth-final');
await click('#wisdom');assert.equal((await ev('__atlas.snapshot()')).visibleTeeth,28);await click('#wisdom');
await click('[data-jaw="lower"]');assert.equal((await ev('__atlas.snapshot()')).visibleTeeth,16);
const point=await ev('__atlas.project(41)');await call('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});assert.equal((await ev('__atlas.snapshot()')).selected,41);
const before=(await ev('__atlas.snapshot()')).camera;
await call('Input.dispatchMouseEvent',{type:'mousePressed',x:750,y:450,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:865,y:470,button:'left',buttons:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:865,y:470,button:'left',clickCount:1});await sleep(250);assert.notDeepEqual((await ev('__atlas.snapshot()')).camera,before);
await click('[data-fdi="36"]');await click('#internal');await sleep(800);assert.equal((await ev('__atlas.snapshot()')).section,true);assert.ok((await ev('__atlas.snapshot()')).caps>0);await shot('section-final');
await ev("document.getElementById('slice').value=35;document.getElementById('slice').dispatchEvent(new Event('input'))");assert.equal((await ev('__atlas.snapshot()')).slice,.35);
await click('[data-tissue="enamel"]');assert.ok(!(await ev('__atlas.snapshot()')).layers.includes('enamel'));
await click('#reset');await sleep(700);assert.equal((await ev('__atlas.snapshot()')).section,false);
await click('#home');await sleep(700);await click('[data-jaw="both"]');await click('#roots');await shot('roots-final');
// Repeated detailed model disposal must not accumulate GPU geometry indefinitely.
const memory=[];for(let i=0;i<3;i++){await click('[data-fdi="16"]');await click('#focus');await sleep(650);memory.push((await ev('__atlas.snapshot()')).geometryMemory);await click('#home');await sleep(650);}assert.ok(memory.at(-1)<=memory[0]+2);
await click('#sources');assert.equal(await ev("document.querySelector('#source-dialog').open"),true);await click('#close-sources');
await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await sleep(400);assert.equal(await ev('document.documentElement.scrollWidth<=innerWidth'),true);
await click('#mobile-info');assert.equal(await ev("document.querySelector('.right-panel').classList.contains('open')"),true);await click('#focus');await sleep(700);await click('#section');await click('#mobile-info');await shot('mobile-final');
// Touch emulation: a two-finger pinch must change the camera distance.
await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
const pinchBefore=(await ev('__atlas.snapshot()')).camera;
await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:140,y:350,id:1},{x:240,y:350,id:2}]});
await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:110,y:350,id:1},{x:270,y:350,id:2}]});
await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(250);
assert.notDeepEqual((await ev('__atlas.snapshot()')).camera,pinchBefore);
await click('#mobile-info');await click('#xray');await sleep(150);assert.equal((await ev('__atlas.snapshot()')).section,false);assert.equal(await ev("document.querySelector('#opacity').value"),'20');await click('#mobile-info');await shot('mobile-xray');
assert.equal(await ev("getComputedStyle(document.querySelector('.always-schema')).display!=='none'"),true);
await click('#reset');await sleep(700);await click('#zoom-out');await sleep(150);
// Programmatic camera buttons exercise automatic scale transition in both directions.
for(let i=0;i<8&&(await ev('__atlas.snapshot()')).mode==='tooth';i++){await click('#zoom-out');await sleep(100);}
await wait("__atlas.snapshot().mode==='mouth'");await sleep(1400);
for(let i=0;i<10&&(await ev('__atlas.snapshot()')).mode==='mouth';i++){await click('#zoom-in');await sleep(100);}
await wait("__atlas.snapshot().mode==='tooth'");
assert.equal(errors.length,0,JSON.stringify(errors));
console.log(JSON.stringify({passed:['32/28 teeth','jaw filtering','raycast FDI selection','mouse orbit','isolate and section','slice offset','tissue visibility','reset and return','GPU resource disposal','sources dialog','mobile controls/no overflow','touch pinch','transparent internal view','persistent schematic label','automatic scale transitions'],gpuMemory:memory,final:await ev('__atlas.snapshot()'),browserErrors:errors.length},null,2));
ws.close();
