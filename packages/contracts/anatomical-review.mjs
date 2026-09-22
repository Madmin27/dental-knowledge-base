import {anatomicalClasses, assertId, snapshotDigest} from '../domain/index.mjs';

// Data contracts only: no credentials, scientific acceptance or release authority.
const check=(ok,message)=>{if(!ok)throw Error(message);};
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=8000;
const texts=v=>Array.isArray(v)&&v.every(text);
const unique=v=>new Set(v).size===v.length;
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const member=(v,values)=>check(values.includes(v),'Unknown controlled value');
const list=(v)=>{check(Array.isArray(v),'Expected array');return v;};
const ids=v=>{list(v).forEach(assertId);check(unique(v),'Duplicate reference');};
const fields=(v,names)=>check(v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).every(k=>names.includes(k))&&names.every(k=>Object.hasOwn(v,k)),'Missing or unsupported contract field');
export const dentitionStages=Object.freeze(['pre_eruptive','primary','mixed','permanent','edentulous','unknown']);
export function isDentalFdi(v){if(!Number.isInteger(v))return false;const quadrant=Math.floor(v/10),position=v%10;return quadrant>=1&&quadrant<=8&&position>=1&&position<=(quadrant<=4?8:5);}

export function validateVariantProfile(input){
  // Reject non-JSON/non-finite input before cloning or calculating review digests.
  snapshotDigest(input);const p=structuredClone(input);
  fields(p,['schemaVersion','id','revision','anatomicalClass','representation','evidenceIds','claimIds','assets','context','teeth','traits','coverage','populationClaims','limitations']);
  check(p.schemaVersion===1,'Unsupported profile version');assertId(p.id);check(Number.isSafeInteger(p.revision)&&p.revision>=0,'Invalid revision');
  member(p.anatomicalClass,anatomicalClasses);member(p.representation,['source_specimen','educational_composite','synthetic_test']);ids(p.evidenceIds);ids(p.claimIds);
  const evidence=(v,required=true)=>{ids(v);check(!required||v.length>0,'Evidence required');check(v.every(id=>p.evidenceIds.includes(id)),'Unregistered evidence reference');};
  check(p.representation==='synthetic_test'||p.evidenceIds.length>0,'Source evidence required');
  list(p.assets).forEach(a=>{fields(a,['id','sha256']);assertId(a.id);check(typeof a.sha256==='string'&&/^[a-f0-9]{64}$/.test(a.sha256),'Invalid asset digest');});check(p.assets.length>0&&unique(p.assets.map(a=>a.id)),'Unique source assets required');
  fields(p.context,['age','sex','dentition','populationDescriptors']);
  if(p.context.age!==null){const a=p.context.age;fields(a,['minMonths','maxMonths','method','evidenceIds']);check(Number.isFinite(a.minMonths)&&a.minMonths>=0&&Number.isFinite(a.maxMonths)&&a.maxMonths>=a.minMonths,'Invalid age interval');check(text(a.method),'Age assessment method required');evidence(a.evidenceIds);}
  if(p.context.sex!==null){const s=p.context.sex;fields(s,['value','recordingMethod','evidenceIds']);member(s.value,['female','male','intersex']);check(text(s.recordingMethod),'Sex recording method required');evidence(s.evidenceIds);}
  const d=p.context.dentition;fields(d,['stage','evidenceIds']);member(d.stage,dentitionStages);evidence(d.evidenceIds,d.stage!=='unknown');
  list(p.context.populationDescriptors).forEach(x=>{fields(x,['kind','label','recordingMethod','evidenceIds']);member(x.kind,['nationality','self_described_ethnicity','recruitment_geography','reported_ancestry']);check(text(x.label)&&text(x.recordingMethod),'Population descriptor needs definition and recording method');evidence(x.evidenceIds);});
  list(p.teeth).forEach(t=>{fields(t,['fdi','presence','eruption','rootDevelopment','evidenceIds']);check(isDentalFdi(t.fdi),'Invalid primary/permanent FDI');member(t.presence,['present','unerupted','extracted','congenitally_absent','not_in_asset','unknown']);member(t.eruption,['not_erupted','partial','erupted','unknown']);member(t.rootDevelopment,['developing','mature','resorbing','unknown']);evidence(t.evidenceIds,!(t.presence==='unknown'&&t.eruption==='unknown'&&t.rootDevelopment==='unknown'));check(t.presence!=='unerupted'||t.eruption==='not_erupted'||t.eruption==='unknown','Contradictory eruption');check(!['extracted','congenitally_absent'].includes(t.presence)||(t.eruption==='unknown'&&t.rootDevelopment==='unknown'),'Absent tooth cannot have current eruption/root state');});check(unique(p.teeth.map(t=>t.fdi)),'Duplicate FDI');
  // Do not infer dentition from chronological age: retained primary teeth are possible.
  list(p.traits).forEach(t=>{fields(t,['structureId','description','evidenceIds']);assertId(t.structureId);check(text(t.description),'Trait description required');evidence(t.evidenceIds);});
  fields(p.coverage,['included','unavailable']);ids(p.coverage.included);list(p.coverage.unavailable).forEach(x=>{fields(x,['structureId','reason']);assertId(x.structureId);check(text(x.reason),'Missing structure reason required');check(!p.coverage.included.includes(x.structureId),'Contradictory coverage');});check(unique(p.coverage.unavailable.map(x=>x.structureId)),'Duplicate missing structure');
  list(p.populationClaims).forEach(c=>{fields(c,['claimId','populationDefinition','studyDesign','samplingMethod','sampleSize','observedCount','evidenceIds','uncertainty','limitations']);assertId(c.claimId);check(p.claimIds.includes(c.claimId),'Unregistered population claim');check(text(c.populationDefinition)&&text(c.studyDesign)&&text(c.samplingMethod)&&text(c.uncertainty)&&texts(c.limitations)&&c.limitations.length>0,'Study scope, uncertainty and limitations required');check(Number.isSafeInteger(c.sampleSize)&&c.sampleSize>1&&Number.isSafeInteger(c.observedCount)&&c.observedCount>=0&&c.observedCount<=c.sampleSize,'Single observation cannot establish population frequency');evidence(c.evidenceIds);});
  check(texts(p.limitations)&&p.limitations.length>0,'Explicit limitations required');return freeze(p);
}

// Trusted, versioned criterion sets come from the review policy service, never the author.
export const educationalAnatomyRubric=freeze({id:'educational-anatomy',version:1,criteria:[
  {id:'source_traceability',required:true},
  {id:'anatomical_relationships',required:true},
  {id:'variant_scope',required:true},
  {id:'developmental_context',required:true},
  {id:'representation_limits',required:true},
  {id:'educational_use',required:true},
]});

/** Validates a reasoned review draft, NOT the reviewer's identity or vote eligibility.
 * An authenticated adapter must supply reviewerId/recordedAt and the frozen target.
 * Never treat this function's success as permission to accept a claim or publish.
 */
export function createReviewDossier(input,{profile,rubric=educationalAnatomyRubric,reviewerId,recordedAt}={}){
  const target=validateVariantProfile(profile);assertId(reviewerId);
  check(typeof recordedAt==='string'&&/^\d{4}-\d{2}-\d{2}T.*Z$/.test(recordedAt)&&Number.isFinite(Date.parse(recordedAt)),'Trusted server timestamp required');
  snapshotDigest(input);fields(input,['id','targetDigest','rubricId','rubricVersion','recommendation','rationale','applicability','limitations','conflictDisclosure','criteria']);assertId(input.id);
  check(input.targetDigest===snapshotDigest(target),'Review target changed; new review required');
  check(input.rubricId===rubric.id&&input.rubricVersion===rubric.version,'Rubric version mismatch');
  member(input.recommendation,['APPROVE','REQUEST_CHANGES','REJECT','ABSTAIN']);
  check(text(input.rationale)&&text(input.applicability)&&text(input.conflictDisclosure)&&texts(input.limitations)&&input.limitations.length>0,'Reason, applicability, limitations and conflict disclosure required');
  const criteria=list(input.criteria);check(unique(criteria.map(c=>c.id)),'Duplicate criterion');
  check(criteria.length===rubric.criteria.length&&criteria.every(c=>rubric.criteria.some(r=>r.id===c.id)),'Complete criterion set required');
  for(const c of criteria){fields(c,['id','result','reason','evidenceIds']);member(c.result,['pass','fail','not_assessed','not_applicable']);check(text(c.reason),'Criterion rationale required');ids(c.evidenceIds);check(c.evidenceIds.every(id=>target.evidenceIds.includes(id)),'Evidence must belong to reviewed target');if(c.result==='pass')check(c.evidenceIds.length>0,'Passing criterion needs evidence');if(input.recommendation==='APPROVE'){const requirement=rubric.criteria.find(r=>r.id===c.id);check(c.result==='pass'||(!requirement.required&&c.result==='not_applicable'),'Unmet criterion blocks approval recommendation');}}
  return freeze({schemaVersion:1,...structuredClone(input),reviewerId,recordedAt,profileId:target.id,profileRevision:target.revision,authorizationGranted:false});
}
