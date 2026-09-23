import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotDigest} from '../packages/domain/index.mjs';
import {planMedia,candidateManifest} from '../packages/mesh-pipeline/media-contract.mjs';
const h='a'.repeat(64);
function input(){const supportMap={schemaVersion:1,meshSha256:h,coordinateFrameId:'model-frame',faceCount:10,regions:[{id:'surface',firstFace:0,faceCount:10,supportType:'image_supported',sourceReferences:[{assetId:'asset-1',sha256:h,viewId:'photo-1',registration:{kind:'projection_2d',sourceFrameId:'camera',targetFrameId:'model-frame',sourceUnits:'pixel',targetUnits:'arbitrary',calibrationSha256:h,poseSha256:h}}],supportConfidence:null,reviewedBy:null,reviewStatus:'pending'}]};return {candidateId:'candidate-1',specimenId:'specimen-1',kind:'photo_set',requestedStructures:['external_surface'],
 sourceAssets:[{id:'asset-1',specimenId:'specimen-1',sha256:h,classification:'reviewed_derivative'}],
 producer:{kind:'ai_assisted',tool:'synthetic-test',codeSha256:h,configurationSha256:h,licenseReviewId:'license-1',weightsSha256:h,seed:42},
 meshSha256:h,supportMap,supportMapSha256:snapshotDigest(supportMap),limitations:['Synthetic fixture; no anatomical validity.']};}
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
 const a=candidateManifest(input());const i=input();i.sourceAssets[0].sha256='b'.repeat(64);i.supportMap.regions[0].sourceReferences[0].sha256=i.sourceAssets[0].sha256;i.supportMapSha256=snapshotDigest(i.supportMap);const b=candidateManifest(i);assert.notEqual(a.manifestSha256,b.manifestSha256);
});
test('demographics and private free-form fields are not inferred or copied',()=>{
 const i=input();i.age=30;i.sex='male';i.patientName='SYNTHETIC';i.producer.prompt='SYNTHETIC';const m=candidateManifest(i);assert.equal(m.age,undefined);assert.equal(m.patientName,undefined);assert.equal(m.producer.prompt,undefined);
});

function refresh(i){i.supportMapSha256=snapshotDigest(i.supportMap);return i;}
test('2D-only candidates cannot change class or publication ceiling through asserted scale or approval',()=>{
 const i=input();i.kind='radiograph_2d';i.scaleKnown=true;i.publicationCeiling=['specimen_specific_3d_anatomy'];i.canonicalEligible=true;
 const m=candidateManifest(i);assert.equal(m.candidateClass,'AI_INFERRED_HYPOTHESIS');assert.equal(m.canonicalEligible,false);assert.deepEqual(m.publicationCeiling,['illustrative_research_hypothesis','model_prior_visualization']);
 assert.throws(()=>candidateManifest({...i,candidateClass:'RECONSTRUCTED_FROM_CALIBRATED_IMAGING'}),/cannot override/);
 assert.throws(()=>candidateManifest({...i,method:'volume_segmentation'}),/incompatible/);
 assert.throws(()=>candidateManifest({...i,requestedPublicationScope:'specimen_specific_3d_anatomy'}),/ceiling/);
 assert.throws(()=>candidateManifest({...i,requestedPublicationScope:'canonical'}),/ceiling/);
});
test('calibrated volume and unverified scale have distinct classes',()=>{
 const i=input();i.kind='volume_3d';i.scaleKnown=true;assert.equal(candidateManifest(i).candidateClass,'OBSERVATION_DERIVED');
 i.calibrationRecordId='verified-record-reference';assert.equal(candidateManifest(i).candidateClass,'RECONSTRUCTED_FROM_CALIBRATED_IMAGING');
});
test('inferred completion cannot hide under a multiview surface class',()=>{
 const i=input();i.supportMap.regions[0].faceCount=5;i.supportMap.regions.push({...structuredClone(i.supportMap.regions[0]),id:'completed',firstFace:5,supportType:'inferred'});const m=candidateManifest(refresh(i));assert.equal(m.candidateClass,'HYBRID');assert.ok(!m.publicationCeiling.includes('specimen_specific_3d_anatomy'));
 assert.throws(()=>candidateManifest({...i,candidateClass:'MULTIVIEW_SURFACE_RECONSTRUCTION'}),/cannot override/);
});
test('support maps reject missing coverage, unsupported source, wrong frame and forged reviewer',()=>{
 for(const mutate of [i=>i.supportMap.faceCount++,i=>i.supportMap.regions[0].firstFace++,i=>i.supportMap.regions[0].sourceReferences=[],i=>i.supportMap.regions[0].sourceReferences[0].sha256='b'.repeat(64),i=>i.supportMap.regions[0].sourceReferences[0].registration.targetFrameId='wrong',i=>i.supportMap.regions[0].reviewedBy='self',i=>i.supportMap.regions[0].reviewStatus='approved',i=>i.supportMap.regions[0].supportConfidence=.9]){
  const i=input();mutate(i);assert.throws(()=>candidateManifest(refresh(i)));
 }
});
test('unknown support and privacy categories do not grant certainty or release',()=>{
 const i=input();i.privacyClasses=['specimen_only_unlinked'];i.supportMap.regions[0].supportType='unknown';i.supportMap.regions[0].sourceReferences=[];const m=candidateManifest(refresh(i));assert.equal(m.privacyRelease,null);assert.equal(m.patientSpecificTruth,false);
 i.kind='radiograph_2d';assert.ok(candidateManifest(i).privacyClasses.includes('radiograph'));
});

test('2D source support cannot claim a depth-bearing affine transform',()=>{
 const i=input();i.supportMap.regions[0].sourceReferences[0].registration={kind:'affine_3d',sourceFrameId:'pixel',targetFrameId:'model-frame',sourceUnits:'pixel',targetUnits:'mm',matrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]};assert.throws(()=>candidateManifest(refresh(i)),/depth-bearing/);
});
