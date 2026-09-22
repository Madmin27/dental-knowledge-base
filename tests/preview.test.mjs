import test from 'node:test';
import assert from 'node:assert/strict';
import {previewServer} from '../apps/preview/server.mjs';
import {evaluateScenario,scenarios} from '../apps/preview/scenarios.mjs';
test('preview scenarios use the rights gate and never grant a clinical or restricted release',async()=>{
  for(const scenario of scenarios) {
    const result=await evaluateScenario(scenario.id);
    assert.equal(result.demo,true);assert.equal(result.allowed,scenario.id==='approved');
  }
  assert.equal(await evaluateScenario('../../.env'),null);
});
test('HTTP preview serves only allowlisted assets and rejects writes and file disclosure',async t=>{
  const server=previewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const health=await (await fetch(base+'/health')).json();assert.equal(health.databaseConnected,false);
  const page=await fetch(base+'/');assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/default-src 'self'/);
  for(const path of ['/api/scenarios','/app.js','/style.css','/overview','/atlas.js','/atlas.css','/atlas-geometry.js','/vendor/three.module.js','/vendor/three.core.js','/vendor/OrbitControls.js','/vendor/THREE-LICENSE.txt']) assert.equal((await fetch(base+path)).status,200);
  for(const path of ['/.env','/sohbet.md','/packages/rights/index.mjs','/api/check?scenario=invalid']) assert.equal((await fetch(base+path)).status,404);
  assert.equal((await fetch(base+'/api/check',{method:'POST',body:'{}'})).status,405);
  assert.equal((await (await fetch(base+'/api/check?scenario=approved')).json()).allowed,true);
  assert.equal((await (await fetch(base+'/api/check?scenario=nc')).json()).allowed,false);
});
