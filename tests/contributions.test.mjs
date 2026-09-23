import {request as httpRequest} from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,readdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {previewServer} from '../apps/preview/server.mjs';
import {createIntake,loadCatalog} from '../apps/preview/contributions.mjs';
const hex=n=>randomBytes(n).toString('hex');
const catalog=await loadCatalog();
function payload(){return{id:hex(16),category:'anatomy',role:'student',alias:'Synthetic reviewer',description:'Synthetic test observation only.',expected:'Synthetic expectation',evidence:['https://example.org/evidence'],consent:true,view:{version:1,assets:catalog.assets,structure:catalog.structures[0].name,state:{selected:16,jaw:'both',mode:'mouth',bones:true,nerves:false,arteries:false,opening:0,gingivaOpacity:.4,boneOpacity:.3},camera:[100,30,200],target:[0,0,0]}};}
async function setup(t,options={}){const directory=await mkdtemp(join(tmpdir(),'dkb-intake-'));const adminKey=hex(32);const origin='http://localhost:3059';let server;
const start=async()=>{const intake=await createIntake({directory,origin,adminKey,catalog,...options});server=previewServer({intake});await new Promise(r=>server.listen(0,'127.0.0.1',r));};await start();
const close=()=>new Promise(r=>{server.close(r);server.closeAllConnections();});t.after(async()=>{await close();await rm(directory,{recursive:true,force:true});});
const call=(path='',key=hex(32),body,extra={})=>new Promise((resolve,reject)=>{const req=httpRequest({hostname:'127.0.0.1',port:server.address().port,path:'/api/contributions'+path,method:body?'POST':'GET',headers:{Host:'localhost:3059',Origin:origin,Authorization:'Bearer '+key,'Content-Type':'application/json','X-DKB-Request':'1',...extra}},res=>{let raw='';res.on('data',c=>raw+=c);res.on('end',()=>{try{resolve({status:res.statusCode,data:JSON.parse(raw)});}catch(e){reject(e);}});});req.on('error',reject);req.end(body?JSON.stringify(body):undefined);});return{directory,adminKey,call,restart:async()=>{await close();await start();}};}
test('durable receipt, exact replay, retry idempotence and confidentiality',async t=>{const s=await setup(t);const p=payload(),key=hex(32);assert.equal((await s.call('',key,p)).status,201);assert.equal((await s.call('',key,p)).status,200);assert.equal((await s.call('',key,{...p,description:'Different synthetic description'})).status,409);assert.equal((await s.call('',hex(32),p)).status,409);
const raw=await readFile(join(s.directory,p.id+'.json'),'utf8');assert.ok(!raw.includes(key));const good=await s.call('/'+p.id,key);assert.equal(good.data.keyHash,undefined);assert.deepEqual(good.data.submission.view,p.view);
const denied=await s.call('/'+p.id,hex(32)),missing=await s.call('/'+hex(16),hex(32));assert.deepEqual(denied,missing);assert.equal(denied.status,404);assert.equal((await s.call()).status,404);
await writeFile(join(s.directory,'.'+hex(16)+'.tmp'),'torn write');await s.restart();assert.equal((await s.call('/'+p.id,key)).status,200);assert.ok(!(await readdir(s.directory)).some(f=>f.endsWith('.tmp')));assert.equal((await s.call('',s.adminKey)).data.records.length,1);});
test('history permissions, required evidence, revision recovery and concurrent edits',async t=>{const s=await setup(t),p=payload(),key=hex(32);await s.call('',key,p);const path='/'+p.id+'/events';assert.equal((await s.call(path,key,{revision:0,status:'addressed',note:'Forged authority'})).status,403);assert.equal((await s.call(path,s.adminKey,{revision:0,status:'accepted',note:'Forged academic status'})).status,422);
assert.equal((await s.call(path,s.adminKey,{revision:0,status:'triage',note:'Synthetic triage'})).status,200);
const results=await Promise.all([s.call(path,key,{revision:1,note:'First synthetic followup'}),s.call(path,key,{revision:1,note:'Second synthetic followup'})]);assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);await s.restart();assert.equal((await s.call('/'+p.id,key)).data.revision,2);
assert.equal((await s.call(path,s.adminKey,{revision:2,status:'change_planned',note:'Synthetic change planned'})).status,200);assert.equal((await s.call(path,s.adminKey,{revision:3,status:'addressed',note:'Synthetic result'})).status,422);assert.equal((await s.call(path,s.adminKey,{revision:3,status:'addressed',note:'Synthetic result',evidence:['https://example.org/change']})).status,200);});
test('strict view, origin, host, payload limits and quota',async t=>{const s=await setup(t,{maxRecords:1}),key=hex(32);let p=payload();assert.equal((await s.call('',key,p,{Origin:'http://evil.example'})).status,403);assert.equal((await s.call('',key,p,{Host:'evil.example:3059'})).status,403);assert.equal((await s.call('',key,p,{'Content-Type':'text/plain'})).status,415);
assert.equal((await s.call('',key,{...p,consent:false})).status,422);assert.equal((await s.call('',key,{...p,evidence:['javascript:alert(1)']})).status,422);
assert.equal((await s.call('',key,{...p,description:'ü'.repeat(13000)})).status,413);
const stale=structuredClone(p);stale.view.assets.dentition='old';assert.equal((await s.call('',key,stale)).status,422);const bad=structuredClone(p);bad.view.camera=[null,0,1];assert.equal((await s.call('',key,bad)).status,422);
assert.equal((await s.call('',key,p)).status,201);assert.equal((await s.call('',hex(32),payload())).status,503);});
test('HTTPS public origin supports receipts and followups without trusting forwarded headers',async t=>{
 const origin='https://dental.example.org',s=await setup(t,{origin});
 const headers={Host:'dental.example.org',Origin:origin};
 const p=payload(),key=hex(32);
 assert.equal((await s.call('',key,p,headers)).status,201);
 assert.equal((await s.call('/'+p.id,key,undefined,headers)).status,200);
 assert.equal((await s.call('/'+p.id+'/events',key,{revision:0,note:'Synthetic public-origin followup'},headers)).status,200);
 assert.equal((await s.call('/'+p.id,hex(32),undefined,headers)).status,404);
 for(const extra of [
  {Origin:'http://dental.example.org'},
  {Origin:'https://dental.example.org.evil.example'},
  {Host:'localhost:3059','X-Forwarded-Host':'dental.example.org'},
  {Origin:'http://localhost:3059','X-Forwarded-Proto':'https'},
  {Origin:''},
 ]) assert.equal((await s.call('',key,p,{...headers,...extra})).status,403);
 await s.restart();
 assert.equal((await s.call('/'+p.id,key,undefined,headers)).data.revision,1);
});
test('bounded request rate throttles creation',async t=>{const s=await setup(t,{rateLimit:2});for(let i=0;i<2;i++)assert.equal((await s.call('',hex(32),payload())).status,201);assert.equal((await s.call('',hex(32),payload())).status,429);});
test('privacy redaction removes free text without resurrecting it on retry',async t=>{const s=await setup(t),p=payload(),key=hex(32);await s.call('',key,p);assert.equal((await s.call('/'+p.id+'/redact',key,{revision:0})).status,404);const r=await s.call('/'+p.id+'/redact',s.adminKey,{revision:0});assert.equal(r.status,200);assert.ok(r.data.redactedAt);assert.equal(r.data.submission.alias,'');assert.equal((await s.call('',key,p)).status,409);assert.equal((await s.call('/'+p.id+'/events',key,{revision:1,note:'Should not resurrect'})).status,409);const disk=await readFile(join(s.directory,p.id+'.json'),'utf8');assert.ok(!disk.includes(p.description));});
test('abrupt writer death preserves every acknowledged record and leaves only complete JSON',async t=>{
  const {fork}=await import('node:child_process');const directory=await mkdtemp(join(tmpdir(),'dkb-crash-'));const adminKey=hex(32);let child;
  t.after(async()=>{if(child&&!child.killed)child.kill('SIGKILL');await rm(directory,{recursive:true,force:true});});
  const start=()=>new Promise((resolve,reject)=>{child=fork(new URL('./helpers/intake-worker.mjs',import.meta.url),[],{env:{...process.env,TEST_INTAKE_DIR:directory,TEST_INTAKE_KEY:adminKey},stdio:['ignore','ignore','pipe','ipc']});child.once('error',reject);child.once('message',m=>resolve(m.port));});
  let port=await start();const acknowledged=[];
  const send=p=>new Promise(resolve=>{const req=httpRequest({hostname:'127.0.0.1',port,path:'/api/contributions',method:'POST',headers:{Host:'localhost:3059',Origin:'http://localhost:3059',Authorization:'Bearer '+hex(32),'Content-Type':'application/json','X-DKB-Request':'1'}},res=>{res.resume();res.on('end',()=>{if(res.statusCode===201)acknowledged.push(p.id);resolve();});res.on('error',()=>resolve());});req.on('error',()=>resolve());req.end(JSON.stringify(p));});
  await send(payload());const jobs=Array.from({length:30},()=>send(payload()));await new Promise(r=>setTimeout(r,10));const exited=new Promise(r=>child.once('exit',r));child.kill('SIGKILL');await exited;await Promise.all(jobs);
  for(const id of acknowledged)assert.equal(JSON.parse(await readFile(join(directory,id+'.json'),'utf8')).id,id);
  port=await start();for(const name of await readdir(directory)){assert.ok(!name.endsWith('.tmp'));if(name.endsWith('.json'))JSON.parse(await readFile(join(directory,name),'utf8'));}
  const stopped=new Promise(r=>child.once('exit',r));child.kill('SIGKILL');await stopped;assert.ok(acknowledged.length>=1);
});
test('optional evidence, stripped untrusted view text and maintainer comment-only',async t=>{const s=await setup(t),p=payload(),key=hex(32);delete p.evidence;p.view.untrusted='MUST_NOT_PERSIST';p.view.state.untrusted='MUST_NOT_PERSIST';assert.equal((await s.call('',key,p)).status,201);const comment=await s.call('/'+p.id+'/events',s.adminKey,{revision:0,note:'Synthetic maintainer comment only'});assert.equal(comment.status,200);assert.equal(comment.data.status,'received');assert.deepEqual(comment.data.submission.evidence,[]);assert.ok(!(await readFile(join(s.directory,p.id+'.json'),'utf8')).includes('MUST_NOT_PERSIST'));assert.equal((await s.call('/'+p.id+'/redact',s.adminKey,{revision:1})).data.revision,2);assert.equal((await s.call('/'+p.id+'/redact',s.adminKey,{revision:1})).data.revision,2);});
test('research contributions bind all source hashes and cut/camera state independently of whole-mouth atlas',async t=>{
 const research={id:'kang-2024-pulp-v1',assets:{tooth:'a'.repeat(64),pulp:'b'.repeat(64),pdl:'c'.repeat(64)}};
 const s=await setup(t,{catalog:{...catalog,research}}),p=payload(),key=hex(32);
 p.view={kind:'tooth-interior',version:1,source:research.id,assets:research.assets,structure:'pulp',state:{step:'section',cut:true,axis:'y',position:40,flipped:false,tooth:true,pulp:true,pdl:false,opacity:1},camera:[0,-50,1],target:[0,0,0],up:[0,1,0]};
 assert.equal((await s.call('',key,p)).status,201);const record=(await s.call('/'+p.id,key)).data;assert.deepEqual(record.submission.view,p.view);
 const stale=structuredClone(p);stale.id=hex(16);stale.view.assets.pulp='d'.repeat(64);assert.equal((await s.call('',hex(32),stale)).status,422);
 const invalid=structuredClone(p);invalid.id=hex(16);invalid.view.state.position=101;assert.equal((await s.call('',hex(32),invalid)).status,422);
 const disabled=await setup(t);assert.equal((await disabled.call('',hex(32),p)).status,422);
});
