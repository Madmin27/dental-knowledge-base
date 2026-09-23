// Planning/manifest contract only. Not an upload endpoint, job runner, identity
// service or approval authority. Production must resolve all references server-side.
import {snapshotDigest} from '../domain/index.mjs';
const kinds=['photo_set','radiograph_2d','volume_3d'];
export const candidateClasses=Object.freeze(['OBSERVATION_DERIVED','RECONSTRUCTED_FROM_CALIBRATED_IMAGING','MULTIVIEW_SURFACE_RECONSTRUCTION','AI_INFERRED_HYPOTHESIS','HYBRID']);
export const privacyClasses=Object.freeze(['specimen_only_unlinked','linked_research_specimen','clinical_context','radiograph','volume','face_maxillofacial_identifiable','unknown']);
export const metricFamilies=Object.freeze(['surface_deviation','landmark_error','volumetric_overlap','topology_integrity','scale_consistency','registration_residual','region_support_coverage']);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const id=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);
function requireValue(value,message){if(!value)throw Error(message);}
export function planMedia({kind,specimenId,requestedStructures=['external_surface'],scaleKnown=false,method,calibrationRecordId=null}){
  requireValue(kinds.includes(kind)&&id(specimenId),'Unknown input kind or specimen');
  requireValue(typeof scaleKnown==='boolean','Scale status must be explicit');
  requireValue(Array.isArray(requestedStructures)&&requestedStructures.length>0&&requestedStructures.every(s=>['external_surface','pulp_space','root_canals','bone'].includes(s)),'Unsupported structure');
  if(kind==='photo_set')requireValue(requestedStructures.every(s=>s==='external_surface'),'External photographs cannot establish internal structures');
  const route={photo_set:'multi_view_surface',radiograph_2d:'research_hypothesis',volume_3d:'volume_segmentation'}[kind];
  method??={photo_set:'multiview',radiograph_2d:'learned_prior',volume_3d:'volume_segmentation'}[kind];
  requireValue(({photo_set:['multiview','learned_prior','hybrid'],radiograph_2d:['learned_prior','hybrid'],volume_3d:['volume_segmentation','learned_prior','hybrid']})[kind].includes(method),'Method incompatible with input evidence');
  requireValue(calibrationRecordId===null||id(calibrationRecordId),'Invalid calibration reference');
  const candidateClass=method==='learned_prior'?'AI_INFERRED_HYPOTHESIS':method==='hybrid'?'HYBRID':method==='multiview'?'MULTIVIEW_SURFACE_RECONSTRUCTION':calibrationRecordId?'RECONSTRUCTED_FROM_CALIBRATED_IMAGING':'OBSERVATION_DERIVED';
  return Object.freeze({kind,specimenId,route,method,candidateClass,calibrationRecordId,requestedStructures:[...new Set(requestedStructures)],
    scale:scaleKnown?'requires_verification':'unknown',
    patientSpecificTruth:false,autoPublish:false,trainingPermission:false,
    requires:['private_quarantine','rights_review','human_privacy_review','human_job_request','technical_qc','expert_review','separate_release_decision']});
}

// A complete mesh face partition; values are metadata assertions, not proof of
// registration accuracy, reviewer authority or calibrated confidence.
export function validateSupportMap(map,{meshSha256,sourceAssets,kind}){
  requireValue(map?.schemaVersion===1&&map.meshSha256===meshSha256&&id(map.coordinateFrameId),'Support map must bind mesh and coordinate frame');
  requireValue(Number.isSafeInteger(map.faceCount)&&map.faceCount>0&&map.faceCount<=10000000,'Invalid face count');
  requireValue(Array.isArray(map.regions)&&map.regions.length>0&&map.regions.length<=10000,'Support regions required');
  const sources=new Map(sourceAssets.map(s=>[s.id,s.sha256]));let next=0;const regionIds=new Set();
  for(const region of map.regions){
    requireValue(id(region.id)&&!regionIds.has(region.id),'Duplicate or invalid region');regionIds.add(region.id);
    requireValue(region.firstFace===next&&Number.isSafeInteger(region.faceCount)&&region.faceCount>0,'Support regions must partition faces without gaps or overlap');next+=region.faceCount;
    requireValue(['image_supported','inferred','unknown'].includes(region.supportType),'Invalid support type');
    requireValue(region.reviewStatus==='pending'&&region.reviewedBy===null,'New candidate support reviews must start pending');
    requireValue(region.supportConfidence===null||(Number.isFinite(region.supportConfidence)&&region.supportConfidence>=0&&region.supportConfidence<=1&&id(region.confidenceMethodId)),'Confidence needs a method or must remain null');
    requireValue(Array.isArray(region.sourceReferences)&&region.sourceReferences.length<=120,'Bounded source references required');
    if(region.supportType==='image_supported')requireValue(region.sourceReferences.length>0,'Supported regions require source references');
    if(region.supportType==='unknown')requireValue(region.sourceReferences.length===0&&region.supportConfidence===null,'Unknown regions cannot assert evidence or confidence');
    for(const source of region.sourceReferences){
      requireValue(sources.has(source.assetId)&&sources.get(source.assetId)===source.sha256&&id(source.viewId),'Source reference must match input derivative hash and view/slice');
      const r=source.registration;
      if(kind!=='volume_3d')requireValue(r?.kind==='projection_2d','2D input cannot supply a depth-bearing affine registration');
      requireValue(r&&id(r.sourceFrameId)&&r.targetFrameId===map.coordinateFrameId&&['mm','voxel','pixel','arbitrary'].includes(r.sourceUnits)&&['mm','arbitrary'].includes(r.targetUnits),'Registration frames/units required');
      if(r.kind==='affine_3d')requireValue(Array.isArray(r.matrix)&&r.matrix.length===16&&r.matrix.every(Number.isFinite)&&r.matrix.slice(12).join(',')==='0,0,0,1','Invalid row-major affine matrix');
      else requireValue(r.kind==='projection_2d'&&hash(r.calibrationSha256)&&hash(r.poseSha256),'2D support requires pinned camera calibration and pose');
    }
  }
  requireValue(next===map.faceCount,'Support map must cover every face');
  return snapshotDigest(map);
}

export function candidateManifest(input){
  const {candidateId,specimenId,kind,requestedStructures,sourceAssets,producer,meshSha256,supportMapSha256,supportMap,limitations,scaleKnown=false,parentCandidateId=null,method,calibrationRecordId=null}=input;
  const plan=planMedia({kind,specimenId,requestedStructures,scaleKnown,method,calibrationRecordId});
  requireValue(id(candidateId)&&(!parentCandidateId||id(parentCandidateId))&&candidateId!==parentCandidateId,'Invalid candidate identity');
  requireValue(Array.isArray(sourceAssets)&&sourceAssets.length>0&&sourceAssets.length<=120,'Source set required');
  requireValue(new Set(sourceAssets.map(s=>s.id)).size===sourceAssets.length,'Duplicate source asset');
  for(const s of sourceAssets)requireValue(id(s.id)&&s.specimenId===specimenId&&hash(s.sha256)&&s.classification==='reviewed_derivative','Use reviewed derivatives of one specimen only');
  requireValue(producer&&['ai_assisted','geometric_reconstruction'].includes(producer.kind)&&id(producer.tool)&&hash(producer.codeSha256)&&hash(producer.configurationSha256)&&id(producer.licenseReviewId),'Pinned tool, configuration and license review required');
  if(producer.kind==='ai_assisted')requireValue(hash(producer.weightsSha256)&&typeof producer.seed==='number'&&Number.isSafeInteger(producer.seed),'AI weights and seed required');
  requireValue(hash(meshSha256)&&hash(supportMapSha256),'Mesh and evidence-support map required');
  requireValue(validateSupportMap(supportMap,{meshSha256,sourceAssets,kind})===supportMapSha256,'Support map digest mismatch');
  const inferred=supportMap.regions.some(r=>r.supportType==='inferred');
  const candidateClass=inferred&&!['AI_INFERRED_HYPOTHESIS','HYBRID'].includes(plan.candidateClass)
    ?(supportMap.regions.some(r=>r.supportType==='image_supported')?'HYBRID':'AI_INFERRED_HYPOTHESIS'):plan.candidateClass;
  requireValue(input.candidateClass===undefined||input.candidateClass===candidateClass,'Candidate class cannot override evidence');
  if(['AI_INFERRED_HYPOTHESIS','HYBRID'].includes(candidateClass))requireValue(producer.kind==='ai_assisted','Inferred candidate requires pinned AI provenance');
  const profiles=input.privacyClasses??['unknown'];
  requireValue(Array.isArray(profiles)&&profiles.length>0&&profiles.every(p=>privacyClasses.includes(p)),'Unknown privacy classification');
  const publicScopes=kind==='radiograph_2d'||['AI_INFERRED_HYPOTHESIS','HYBRID'].includes(candidateClass)||candidateClass==='OBSERVATION_DERIVED'
    ?['illustrative_research_hypothesis','model_prior_visualization']:['source_bounded_educational_derivative'];
  requireValue(Array.isArray(limitations)&&limitations.length>0&&limitations.length<=20&&limitations.every(s=>typeof s==='string'&&s.trim().length>0&&s.length<=500),'Explicit limitations required');
  requireValue(input.requestedPublicationScope===undefined||publicScopes.includes(input.requestedPublicationScope),'Requested publication exceeds evidence ceiling');
  const manifest={schemaVersion:2,candidateId,parentCandidateId,specimenId,route:plan.route,method:plan.method,candidateClass,calibrationRecordId,
    evidenceBasis:kind,publicationCeiling:publicScopes,canonicalEligible:false,
    privacyClasses:[...new Set([...profiles,...(kind==='radiograph_2d'?['radiograph']:kind==='volume_3d'?['volume']:[])])],privacyRelease:null,
    sourceAssets:sourceAssets.map(s=>({id:s.id,sha256:s.sha256,specimenId:s.specimenId})),
    producer:{kind:producer.kind,tool:producer.tool,codeSha256:producer.codeSha256,configurationSha256:producer.configurationSha256,licenseReviewId:producer.licenseReviewId,
      ...(producer.kind==='ai_assisted'?{weightsSha256:producer.weightsSha256,seed:producer.seed}:{})},
    meshSha256,supportMapSha256,requestedStructures:plan.requestedStructures,scale:plan.scale,limitations:[...limitations],
    status:'candidate',academicAcceptance:null,publication:'private',criticism:'open',patientSpecificTruth:false};
  return {...manifest,manifestSha256:snapshotDigest(manifest)};
}
