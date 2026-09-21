import { assertId, snapshotDigest, createTransitionEngine } from '../domain/index.mjs';

export const RIGHTS_POLICY_VERSION = 'rights-v1';
export const permissions = Object.freeze(['publicWebDisplay','modification','internalProcessing','redistribution','endUserDownload','sublicensing','commercialUse']);
const licenses = ['UNKNOWN','CC0-1.0','PUBLIC-DOMAIN','CC-BY-4.0','CC-BY-SA-4.0','CC-BY-NC-4.0','CC-BY-NC-SA-4.0','CC-BY-ND-4.0','CC-BY-NC-ND-4.0','CUSTOM','PURCHASED'];
const text = v => typeof v === 'string' && v.trim().length > 0;
const freeze = v => { if(v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
const clone = v => freeze(JSON.parse(JSON.stringify(v)));
const date = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(v)
  && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === (v.includes('.') ? v : v.replace('Z','.000Z'));

export function validateRightsRecord(record) {
  assertId(record?.id); assertId(record?.assetId);
  if (!Number.isSafeInteger(record.revision) || record.revision < 0) throw new Error('Invalid rights revision');
  const d=record.document;
  if (!d || !['UNKNOWN','APPROVED','REJECTED','REVOKED'].includes(d.status)
    || !text(d.reason) || !text(d.correlationId) || d.policyVersion !== RIGHTS_POLICY_VERSION
    || !licenses.includes(d.license) || !text(d.sourceRef)
    || permissions.some(p=>typeof d.permissions?.[p] !== 'boolean')
    || typeof d.independentPermission !== 'boolean' || typeof d.shareAlikeCompatible !== 'boolean'
    || !(d.expiresAt === null || date(d.expiresAt))
    || !Array.isArray(d.territories) || !d.territories.length || d.territories.some(t=>!text(t))
    || typeof d.attribution?.required !== 'boolean' || typeof d.attribution.text !== 'string') {
    throw new Error('Incomplete rights record');
  }
  if(d.status === 'APPROVED') {
    assertId(d.review?.actorId); assertId(d.review?.decisionId);
    if(d.review.actorKind !== 'human' || !['rights_reviewer','maintainer'].includes(d.review.role)) throw new Error('Human rights approval required');
  }
  snapshotDigest(record); // reject non-JSON/undefined values before storing or trusting them
  return record;
}

/** Rights-only gate. Load current records from trusted storage, never request JSON.
 * verifyReview must authenticate the exact immutable record and rights authority;
 * role strings alone do not grant authority. This is project policy, not legal advice.
 */
export function createRightsGate({ loadCurrent, verifyReview, clock=()=>new Date() }={}) {
  return async function check(manifest) {
    const reasons=[]; const decisions=[]; const expirations=[];
    let m;
    try { snapshotDigest(manifest); m=clone(manifest); }
    catch { return freeze({allowed:false,reasons:['INVALID_MANIFEST'],decisions:[]}); }
    const now=clock();
    if(!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('Invalid server clock');
    if(!m || !Array.isArray(m.assets) || !m.assets.length || !text(m.territory)
      || typeof loadCurrent !== 'function' || typeof verifyReview !== 'function') {
      return freeze({allowed:false,reasons:['MISSING_MANIFEST_OR_TRUSTED_ADAPTER'],decisions:[]});
    }
    const seen=new Set();
    for(const item of m.assets) {
      try {
        assertId(item.assetId); assertId(item.rightsId);
        if(seen.has(item.assetId)) throw new Error('DUPLICATE_ASSET');
        seen.add(item.assetId);
        if(!/^[a-f0-9]{64}$/.test(item.sha256) || permissions.some(p=>typeof item.use?.[p] !== 'boolean')
          || item.use.publicWebDisplay !== true || item.use.commercialUse !== true) throw new Error('INVALID_USE');
        const loaded=await loadCurrent(item.assetId);
        if(!loaded) throw new Error('MISSING_RIGHTS');
        const {asset,record}=clone(loaded);
        validateRightsRecord(record);
        if(asset.id !== item.assetId || record.assetId !== item.assetId || asset.sha256 !== item.sha256
          || record.id !== item.rightsId || record.revision !== item.rightsRevision) throw new Error('STALE_OR_MISMATCHED_RIGHTS');
        const d=record.document;
        if(d.status !== 'APPROVED' || d.license === 'UNKNOWN') throw new Error('UNAPPROVED_RIGHTS');
        if(!['synthetic','external','contributor','human_derived'].includes(asset.origin)
          || typeof asset.institutionOwned !== 'boolean') throw new Error('MISSING_PROVENANCE');
        // Clinical privacy/quarantine approval is a separate future workflow.
        if(asset.origin === 'human_derived') throw new Error('PRIVACY_REVIEW_REQUIRED');
        if(asset.origin === 'contributor' && !text(d.contributorAuthorityRef)) throw new Error('CONTRIBUTOR_AUTHORITY_REQUIRED');
        if(asset.institutionOwned && !text(d.institutionalApprovalRef)) throw new Error('INSTITUTIONAL_APPROVAL_REQUIRED');
        if(await verifyReview(record,freeze({asset,recordDigest:snapshotDigest(record),policyVersion:RIGHTS_POLICY_VERSION})) !== true) throw new Error('UNVERIFIED_REVIEW');
        if(d.expiresAt !== null && Date.parse(d.expiresAt) <= now.getTime()) throw new Error('EXPIRED_RIGHTS');
        if(!d.territories.includes('WORLDWIDE') && !d.territories.includes(m.territory)) throw new Error('TERRITORY_RESTRICTED');
        if(d.expiresAt !== null) expirations.push(Date.parse(d.expiresAt));
        const independent=d.independentPermission && text(d.permissionRef);
        if(d.license.includes('-NC') && !independent) throw new Error('NC_PERMISSION_REQUIRED');
        if(d.license.includes('-ND') && item.use.modification && !independent) throw new Error('ND_DERIVATIVE_FORBIDDEN');
        if(d.license.includes('-SA') && !independent && !d.shareAlikeCompatible) throw new Error('SHARE_ALIKE_INCOMPATIBLE');
        if(!['CC0-1.0','PUBLIC-DOMAIN','CC-BY-4.0','CC-BY-SA-4.0'].includes(d.license) && !text(d.permissionRef)) throw new Error('EXPLICIT_PERMISSION_REQUIRED');
        if(permissions.some(p=>item.use[p] && !d.permissions[p])) throw new Error('MISSING_PERMISSION');
        if((d.attribution.required || d.license.startsWith('CC-BY'))
          && (!text(d.attribution.text) || item.attribution !== d.attribution.text)) throw new Error('ATTRIBUTION_REQUIRED');
        decisions.push({assetId:asset.id,rightsId:record.id,revision:record.revision,recordDigest:snapshotDigest(record)});
      } catch(error) { reasons.push({assetId:item?.assetId ?? null,code:error.message}); }
    }
    const finished=clock();
    if(!(finished instanceof Date) || !Number.isFinite(finished.getTime())) throw new Error('Invalid server clock');
    if(expirations.some(expiry=>expiry<=finished.getTime())) reasons.push('EXPIRED_DURING_CHECK');
    return freeze({allowed:reasons.length===0,reasons,decisions,manifestDigest:snapshotDigest(m),validUntil:expirations.length ? new Date(Math.min(...expirations)).toISOString() : null,policyVersion:RIGHTS_POLICY_VERSION,checkedAt:now.toISOString()});
  };
}

/** Re-evaluates at freeze, approval AND publication; a past PASS is not a permit.
 * This returns a domain snapshot only. Future persistence must hold the storage
 * transaction/asset locks through evaluation and the release write.
 */
export function createRightsCheckedReleaseTransition({loadCurrent,verifyReview,clock, ...policy}={}) {
  const check=createRightsGate({loadCurrent,verifyReview,clock});
  return async (entity,target,context)=>{
    const snapshot=clone(entity); const ctx=clone(context);
    const needed=snapshot.kind==='release' && ['FROZEN_FOR_REVIEW','APPROVED','PUBLISHED'].includes(target);
    const result=needed ? await check(snapshot.manifest) : null;
    const run=createTransitionEngine({...policy,clock,verifyReleaseRights:facts=>
      result?.allowed === true && (result.validUntil === null || Date.parse(facts.at) < Date.parse(result.validUntil))
      && result.manifestDigest === snapshotDigest(facts.entity.manifest)});
    return run(snapshot,target,ctx);
  };
}
