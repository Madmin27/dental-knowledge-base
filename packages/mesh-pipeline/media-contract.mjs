// Planning/manifest contract only. Not an upload endpoint, job runner, identity
// service or approval authority. Production must resolve all references server-side.
import {snapshotDigest} from '../domain/index.mjs';
const kinds=['photo_set','radiograph_2d','volume_3d'];
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const id=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);
function requireValue(value,message){if(!value)throw Error(message);}
export function planMedia({kind,specimenId,requestedStructures=['external_surface'],scaleKnown=false}){
  requireValue(kinds.includes(kind)&&id(specimenId),'Unknown input kind or specimen');
  requireValue(typeof scaleKnown==='boolean','Scale status must be explicit');
  requireValue(Array.isArray(requestedStructures)&&requestedStructures.length>0&&requestedStructures.every(s=>['external_surface','pulp_space','root_canals','bone'].includes(s)),'Unsupported structure');
  if(kind==='photo_set')requireValue(requestedStructures.every(s=>s==='external_surface'),'External photographs cannot establish internal structures');
  const route={photo_set:'multi_view_surface',radiograph_2d:'research_hypothesis',volume_3d:'volume_segmentation'}[kind];
  return Object.freeze({kind,specimenId,route,requestedStructures:[...new Set(requestedStructures)],
    scale:scaleKnown?'requires_verification':'unknown',
    patientSpecificTruth:false,autoPublish:false,trainingPermission:false,
    requires:['private_quarantine','rights_review','human_privacy_review','human_job_request','technical_qc','expert_review','separate_release_decision']});
}
export function candidateManifest(input){
  const {candidateId,specimenId,kind,requestedStructures,sourceAssets,producer,meshSha256,supportMapSha256,limitations,scaleKnown=false,parentCandidateId=null}=input;
  const plan=planMedia({kind,specimenId,requestedStructures,scaleKnown});
  requireValue(id(candidateId)&&(!parentCandidateId||id(parentCandidateId))&&candidateId!==parentCandidateId,'Invalid candidate identity');
  requireValue(Array.isArray(sourceAssets)&&sourceAssets.length>0&&sourceAssets.length<=120,'Source set required');
  requireValue(new Set(sourceAssets.map(s=>s.id)).size===sourceAssets.length,'Duplicate source asset');
  for(const s of sourceAssets)requireValue(id(s.id)&&s.specimenId===specimenId&&hash(s.sha256)&&s.classification==='reviewed_derivative','Use reviewed derivatives of one specimen only');
  requireValue(producer&&['ai_assisted','geometric_reconstruction'].includes(producer.kind)&&id(producer.tool)&&hash(producer.codeSha256)&&hash(producer.configurationSha256)&&id(producer.licenseReviewId),'Pinned tool, configuration and license review required');
  if(producer.kind==='ai_assisted')requireValue(hash(producer.weightsSha256)&&typeof producer.seed==='number'&&Number.isSafeInteger(producer.seed),'AI weights and seed required');
  requireValue(hash(meshSha256)&&hash(supportMapSha256),'Mesh and evidence-support map required');
  requireValue(Array.isArray(limitations)&&limitations.length>0&&limitations.length<=20&&limitations.every(s=>typeof s==='string'&&s.trim().length>0&&s.length<=500),'Explicit limitations required');
  const manifest={schemaVersion:1,candidateId,parentCandidateId,specimenId,route:plan.route,
    sourceAssets:sourceAssets.map(s=>({id:s.id,sha256:s.sha256,specimenId:s.specimenId})),
    producer:{kind:producer.kind,tool:producer.tool,codeSha256:producer.codeSha256,configurationSha256:producer.configurationSha256,licenseReviewId:producer.licenseReviewId,
      ...(producer.kind==='ai_assisted'?{weightsSha256:producer.weightsSha256,seed:producer.seed}:{})},
    meshSha256,supportMapSha256,requestedStructures:plan.requestedStructures,scale:plan.scale,limitations:[...limitations],
    status:'candidate',academicAcceptance:null,publication:'private',criticism:'open',patientSpecificTruth:false};
  return {...manifest,manifestSha256:snapshotDigest(manifest)};
}
