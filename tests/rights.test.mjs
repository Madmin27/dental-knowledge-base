import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {createRightsGate,createRightsCheckedReleaseTransition,permissions} from '../packages/rights/index.mjs';
import {createTransitionEngine,snapshotDigest} from '../packages/domain/index.mjs';
const now=new Date('2026-09-21T12:00:00.000Z');
import {rightsFixture} from './rights-fixture.mjs';

function gate(f, verifyReview=()=>true) { return createRightsGate({loadCurrent:async()=>({asset:f.asset,record:f.record}),verifyReview,clock:()=>now}); }

test('preferred licenses pass only with explicit rights and verified human review',async()=>{
  for(const license of ['CC0-1.0','PUBLIC-DOMAIN','CC-BY-4.0']) {
    const f=rightsFixture();f.record.document.license=license;
    const result=await gate(f)(f.manifest);assert.equal(result.allowed,true);
    assert.ok(Object.isFrozen(result.decisions[0]));assert.equal(result.manifestDigest,snapshotDigest(f.manifest));
  }
});
for(const status of ['UNKNOWN','REJECTED','REVOKED']) test(`AT-P0-005 ${status} blocks release`,async()=>{
  const f=rightsFixture(); f.record.document.status=status;
  assert.equal((await gate(f)(f.manifest)).allowed,false);
});
for(const license of ['CC-BY-NC-4.0','CC-BY-NC-SA-4.0','CC-BY-NC-ND-4.0']) test(`AT-P0-006 ${license} requires independent permission`,async()=>{
  const f=rightsFixture();const d=f.record.document;d.license=license;
  d.permissionRef='invoice-alone';assert.equal((await gate(f)(f.manifest)).allowed,false);
  d.independentPermission=true;assert.equal((await gate(f)(f.manifest)).allowed,true);
  d.permissionRef=null;assert.equal((await gate(f)(f.manifest)).allowed,false);
});
test('ND derivatives and SA compatibility are independent constraints',async()=>{
  const f=rightsFixture();const d=f.record.document;d.license='CC-BY-ND-4.0';d.permissionRef='license-ref';
  assert.equal((await gate(f)(f.manifest)).allowed,false);
  f.manifest.assets[0].use.modification=false;assert.equal((await gate(f)(f.manifest)).allowed,true);
  d.license='CC-BY-SA-4.0';assert.equal((await gate(f)(f.manifest)).allowed,false);
  d.shareAlikeCompatible=true;assert.equal((await gate(f)(f.manifest)).allowed,true);
});
test('purchased/custom rights need a reference and every requested permission',async()=>{
  for(const license of ['PURCHASED','CUSTOM']) {
    const f=rightsFixture();f.record.document.license=license;
    assert.equal((await gate(f)(f.manifest)).allowed,false);
    f.record.document.permissionRef='reviewed-permission';
    assert.equal((await gate(f)(f.manifest)).allowed,true);
    for(const permission of permissions) {
      f.record.document.permissions[permission]=false;
      assert.equal((await gate(f)(f.manifest)).allowed,false,permission);
      f.record.document.permissions[permission]=true;
    }
  }
});
test('expired, territorial and missing attribution constraints block',async()=>{
  for(const change of [
    f=>f.record.document.expiresAt=now.toISOString(),
    f=>f.record.document.territories=['TR'],
    f=>f.manifest.assets[0].attribution='',
    f=>{f.record.document.attribution.required=false;f.record.document.attribution.text='';},
  ]) {const f=rightsFixture();change(f);assert.equal((await gate(f)(f.manifest)).allowed,false);}
  const f=rightsFixture();f.record.document.territories=['TR'];f.manifest.territory='TR';
  assert.equal((await gate(f)(f.manifest)).allowed,true);
});
test('claims of authority, human upload and institutional ownership do not auto-approve',async()=>{
  for(const change of [f=>f.asset.origin='human_derived',f=>f.asset.origin='contributor',f=>f.asset.institutionOwned=true,
    f=>f.record.document.review.actorKind='ai',f=>f.record.document.review.role='academic_reviewer']) {
    const f=rightsFixture();change(f);assert.equal((await gate(f)(f.manifest)).allowed,false);
  }
  const f=rightsFixture();f.asset.origin='contributor';f.asset.institutionOwned=true;
  f.record.document.contributorAuthorityRef='agreement';f.record.document.institutionalApprovalRef='institution-decision';
  assert.equal((await gate(f)(f.manifest)).allowed,true);
});
test('verifier is mandatory and bound to exact record digest; modified approval fails',async()=>{
  const f=rightsFixture(); const digest=snapshotDigest(f.record);
  const check=gate(f,(_record,facts)=>facts.recordDigest===digest);
  assert.equal((await check(f.manifest)).allowed,true);
  f.record.document.permissions.modification=false;
  assert.equal((await check(f.manifest)).allowed,false);
  assert.equal((await gate(f,()=>false)(f.manifest)).allowed,false);
  assert.equal((await createRightsGate()(f.manifest)).allowed,false);
});
test('missing, stale, duplicate, malformed and mismatched manifests fail closed',async()=>{
  for(const change of [f=>f.record.revision++,f=>f.record.id=randomUUID(),f=>f.asset.sha256='b'.repeat(64),
    f=>f.manifest.assets.push(f.manifest.assets[0]),f=>delete f.manifest.assets[0].use.modification,
    f=>f.manifest.assets[0].use.commercialUse=false,f=>f.record.document.license='unknown-lowercase',f=>f.record.document.expiresAt='2026-02-30T12:00:00Z']) {
    const f=rightsFixture();change(f);assert.equal((await gate(f)(f.manifest)).allowed,false);
  }
  const f=rightsFixture();for(const value of [null,{},[],{assets:[]}]) assert.equal((await gate(f)(value)).allowed,false);
  assert.equal((await createRightsGate({loadCurrent:async()=>null,verifyReview:()=>true})(f.manifest)).allowed,false);
});
test('expiry during asynchronous review cannot produce a valid result',async()=>{
  const f=rightsFixture();let instant=now;
  f.record.document.expiresAt=new Date(now.getTime()+1000).toISOString();
  const check=createRightsGate({loadCurrent:async()=>f,clock:()=>instant,verifyReview:async()=>{
    instant=new Date(now.getTime()+2000);return true;
  }});
  assert.equal((await check(f.manifest)).allowed,false);
});
function transitionContext(entity,target) {
  const actor={id:'human',kind:'human'};
  return {actor,reason:'Synthetic publication',correlationId:'test',references:{},policyDecision:{
    decision_id:'synthetic-decision',outcome:'ALLOW',policy_version:'test',entity_id:entity.id,entity_kind:'release',
    entity_revision:entity.revision,from_state:entity.state,to_state:target,entity_digest:snapshotDigest(entity),references_digest:snapshotDigest({}),
    actor_scope:{actor_id:actor.id,actor_kind:actor.kind,action:`release:${entity.state}:${target}`},
  }};
}
test('release engine cannot freeze/approve/publish without rights adapter',async()=>{
  for(const [state,target] of [['DRAFT','FROZEN_FOR_REVIEW'],['FROZEN_FOR_REVIEW','APPROVED'],['APPROVED','PUBLISHED']]) {
    const f=rightsFixture();const entity={id:'release',kind:'release',revision:0,state,manifest:f.manifest};
    const ctx=transitionContext(entity,target);
    const policy={policyVersion:'test',verifyPolicyDecision:()=>true,clock:()=>now};
    assert.throws(()=>createTransitionEngine(policy)(entity,target,ctx),/rights gate denied/);
    const run=createRightsCheckedReleaseTransition({...policy,loadCurrent:async()=>f,verifyReview:()=>true});
    assert.equal((await run(entity,target,ctx)).entity.state,target);
    f.record.document.status='REVOKED';
    await assert.rejects(run(entity,target,ctx),/rights gate denied/);
  }
});
test('release wrapper snapshots caller data before awaiting storage',async()=>{
  const f=rightsFixture();const entity={id:'release',kind:'release',revision:0,state:'APPROVED',manifest:f.manifest};
  const ctx=transitionContext(entity,'PUBLISHED');
  const run=createRightsCheckedReleaseTransition({policyVersion:'test',verifyPolicyDecision:()=>true,clock:()=>now,
    loadCurrent:async()=>{entity.manifest.assets=[];return f;},verifyReview:()=>true});
  assert.equal((await run(entity,'PUBLISHED',ctx)).entity.manifest.assets.length,1);
});

test('expiry between gate result and transition is denied at transition time',async()=>{
  const f=rightsFixture();f.record.document.expiresAt=new Date(now.getTime()+1000).toISOString();
  const entity={id:'release',kind:'release',revision:0,state:'APPROVED',manifest:f.manifest};
  let calls=0;
  const run=createRightsCheckedReleaseTransition({policyVersion:'test',verifyPolicyDecision:()=>true,
    clock:()=>++calls<3 ? now : new Date(now.getTime()+2000),loadCurrent:async()=>f,verifyReview:()=>true});
  await assert.rejects(run(entity,'PUBLISHED',transitionContext(entity,'PUBLISHED')),/rights gate denied/);
});
