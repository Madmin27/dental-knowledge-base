import test from 'node:test';
import assert from 'node:assert/strict';
import {planMedia,candidateManifest} from '../packages/mesh-pipeline/media-contract.mjs';
const h='a'.repeat(64);
function input(){return {candidateId:'candidate-1',specimenId:'specimen-1',kind:'photo_set',requestedStructures:['external_surface'],
 sourceAssets:[{id:'asset-1',specimenId:'specimen-1',sha256:h,classification:'reviewed_derivative'}],
 producer:{kind:'ai_assisted',tool:'synthetic-test',codeSha256:h,configurationSha256:h,licenseReviewId:'license-1',weightsSha256:h,seed:42},
 meshSha256:h,supportMapSha256:h,limitations:['Synthetic fixture; no anatomical validity.']};}
test('photo evidence cannot be promoted to unseen pulp or root canal structure',()=>{
 assert.throws(()=>planMedia({kind:'photo_set',specimenId:'s',requestedStructures:['root_canals']}),/internal/);
});
test('2D inference stays a research hypothesis even with asserted scale',()=>{
 const plan=planMedia({kind:'radiograph_2d',specimenId:'s',scaleKnown:true});assert.equal(plan.route,'research_hypothesis');assert.equal(plan.patientSpecificTruth,false);assert.equal(plan.scale,'requires_verification');assert.equal(plan.autoPublish,false);assert.equal(plan.trainingPermission,false);
});
test('candidate creation cannot inherit client-supplied acceptance/publication',()=>{
 const manifest=candidateManifest({...input(),status:'accepted',academicAcceptance:{approved:true},publication:'public',criticism:'closed'});
 assert.equal(manifest.status,'candidate');assert.equal(manifest.academicAcceptance,null);assert.equal(manifest.publication,'private');assert.equal(manifest.criticism,'open');
});
test('mixed specimens and raw source references are rejected',()=>{
 for(const change of [{specimenId:'other'},{classification:'raw_clinical'}]){const i=input();Object.assign(i.sourceAssets[0],change);assert.throws(()=>candidateManifest(i),/one specimen/);}
});
test('unpinned AI weights and unsupported evidence-map claims fail',()=>{
 const i=input();delete i.producer.weightsSha256;assert.throws(()=>candidateManifest(i),/weights/);
 const j=input();delete j.supportMapSha256;assert.throws(()=>candidateManifest(j),/support map/);
});
test('candidate content and evidence versions are bound to a digest',()=>{
 const a=candidateManifest(input());const i=input();i.sourceAssets[0].sha256='b'.repeat(64);const b=candidateManifest(i);assert.notEqual(a.manifestSha256,b.manifestSha256);
});
test('demographics and private free-form fields are not inferred or copied',()=>{
 const i=input();i.age=30;i.sex='male';i.patientName='SYNTHETIC';i.producer.prompt='SYNTHETIC';const m=candidateManifest(i);assert.equal(m.age,undefined);assert.equal(m.patientName,undefined);assert.equal(m.producer.prompt,undefined);
});
