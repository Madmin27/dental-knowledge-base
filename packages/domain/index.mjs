import { createHash, randomUUID } from 'node:crypto';

const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

export const anatomicalClasses = freeze(['canonical', 'variant', 'developmental', 'pathological', 'unknown']);
export const evidenceGrades = freeze(['E0_OBSERVATION', 'E1_REPLICATED_OBSERVATION', 'E2_LITERATURE_SUPPORTED', 'E3_INDEPENDENTLY_VERIFIED']);
export const consensusStates = freeze(['proposed', 'under_review', 'accepted', 'disputed', 'rejected', 'superseded']);
export const reviewDecisions = freeze(['APPROVE', 'REQUEST_CHANGES', 'REJECT', 'ABSTAIN']);
export const actorKinds = freeze(['human', 'ai', 'system']);
// Current generator, not a permanent identity format requirement.
export const newId = () => randomUUID();
export function assertId(id) {
  if (typeof id !== 'string' || !id.trim() || id !== id.trim() || /[\x00-\x1f\x7f]/.test(id)) {
    throw new Error('A non-empty opaque internal ID is required');
  }
  return id;
}

export function validateClassification(value) {
  if (!value || !anatomicalClasses.includes(value.anatomicalClass)
      || !evidenceGrades.includes(value.evidenceGrade)
      || !consensusStates.includes(value.consensusState)) {
    throw new Error('Unknown classification value');
  }
  return value;
}

export const transitions = freeze({
  issue: {
    DRAFT: ['OPEN'], OPEN: ['TRIAGE'],
    TRIAGE: ['NEEDS_EVIDENCE', 'UNDER_REVIEW', 'DUPLICATE', 'INVALID_SPAM'],
    NEEDS_EVIDENCE: ['UNDER_REVIEW'],
    UNDER_REVIEW: ['ACCEPTED_AS_CORRECTION', 'RECLASSIFIED_AS_VARIANT', 'DISPUTED', 'REJECTED', 'SUPERSEDED'],
    DISPUTED: ['UNDER_REVIEW', 'SUPERSEDED'],
    ACCEPTED_AS_CORRECTION: ['RESOLVED'], RECLASSIFIED_AS_VARIANT: ['RESOLVED'],
    DUPLICATE: ['CLOSED'], INVALID_SPAM: ['CLOSED'], REJECTED: ['CLOSED'],
    SUPERSEDED: ['CLOSED'], RESOLVED: ['CLOSED'], CLOSED: [],
  },
  claim: {
    proposed: ['under_review'], under_review: ['accepted', 'disputed', 'rejected'],
    disputed: ['under_review', 'superseded'], accepted: ['disputed', 'superseded'],
    rejected: ['superseded'], superseded: [],
  },
  patch: {
    REQUESTED: ['GENERATING'], GENERATING: ['GENERATED'],
    GENERATED: ['QC_FAILED', 'AWAITING_HUMAN_REVIEW'],
    QC_FAILED: ['SUPERSEDED'], AWAITING_HUMAN_REVIEW: ['APPROVED', 'CHANGES_REQUESTED', 'REJECTED'],
    CHANGES_REQUESTED: ['SUPERSEDED'], APPROVED: ['MERGED_INTO_RELEASE', 'SUPERSEDED'],
    REJECTED: ['SUPERSEDED'], MERGED_INTO_RELEASE: [], SUPERSEDED: [],
  },
  release: {
    DRAFT: ['FROZEN_FOR_REVIEW'], FROZEN_FOR_REVIEW: ['APPROVED', 'SUPERSEDED'],
    APPROVED: ['PUBLISHED', 'SUPERSEDED'], PUBLISHED: ['WITHDRAWN', 'SUPERSEDED'],
    WITHDRAWN: [], SUPERSEDED: [],
  },
});

// Accept plain JSON snapshots only; deterministic digest binds a policy decision
// to content as well as revision (including any frozen manifest).
function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + Array.from(value, canonical).join(',') + ']';
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  throw new Error('Domain snapshots must contain plain JSON values');
}

export function snapshotDigest(entity) {
  return createHash('sha256').update(canonical(entity)).digest('hex');
}

function humanRequired(kind, target) {
  if (kind === 'release') return true;
  if (kind === 'issue') return target !== 'OPEN';
  if (kind === 'claim') return target !== 'under_review';
  return ['APPROVED', 'CHANGES_REQUESTED', 'REJECTED', 'MERGED_INTO_RELEASE', 'SUPERSEDED'].includes(target);
}

function validateReferences(entity, target, refs) {
  const required = [];
  if (target.toLowerCase() === 'superseded') required.push('successor_id');
  if (entity.kind === 'issue') {
    if (target === 'DUPLICATE') required.push('duplicate_issue_id');
    if (target === 'ACCEPTED_AS_CORRECTION') required.push('claim_id');
    if (target === 'RECLASSIFIED_AS_VARIANT') required.push('claim_id', 'variant_id');
    if (target === 'RESOLVED') {
      required.push('claim_id');
      if (entity.state === 'RECLASSIFIED_AS_VARIANT') required.push('variant_id');
      else required.push('patch_id', 'release_id');
    }
    if (target === 'CLOSED') required.push('resolution_event_id');
  }
  if (entity.kind === 'claim' && entity.state === 'accepted' && target === 'disputed') required.push('evidence_id');
  if (entity.kind === 'patch' && target === 'MERGED_INTO_RELEASE') required.push('release_id');
  required.forEach(key => assertId(refs[key]));
  if (refs.successor_id === entity.id || refs.duplicate_issue_id === entity.id) throw new Error('Self reference is forbidden');
}

/** Pure, synchronous state-machine boundary, not an authorization provider.
 * The trusted server must inject a verifier backed by its own policy decisions.
 * Never build this factory or its actor context from HTTP request data.
 * No default verifier grants access; even a matching client-shaped decision fails.
 * Storage, credentials, quorum, QC, rights/privacy, replay protection and atomic
 * compare-and-swap persistence are intentionally outside TASK-002.
 */
export function createTransitionEngine({ verifyPolicyDecision, verifyReleaseRights, policyVersion, clock = () => new Date() } = {}) {
  return function transition(entity, target, { actor, reason, correlationId, policyDecision, references = {} } = {}) {
    assertId(entity?.id);
    assertId(actor?.id);
    assertId(correlationId);
    if (!actorKinds.includes(actor.kind)) throw new Error('Unknown actor kind');
    if (typeof reason !== 'string' || !reason.trim()) throw new Error('An audit reason is required');
    if (!Object.hasOwn(transitions, entity.kind)
        || !Object.hasOwn(transitions[entity.kind], entity.state)
        || !transitions[entity.kind][entity.state].includes(target)) throw new Error('Invalid state transition');
    if (humanRequired(entity.kind, target) && actor.kind !== 'human') throw new Error('Human decision required');
    if (!Number.isSafeInteger(entity.revision) || entity.revision < 0
        || entity.revision === Number.MAX_SAFE_INTEGER) throw new Error('Invalid revision');

    const instant = clock();
    if (!(instant instanceof Date) || !Number.isFinite(instant.getTime())) throw new Error('Invalid server clock');
    const snapshot = freeze(structuredClone(entity));
    const refs = freeze(structuredClone(references));
    if (!refs || Array.isArray(refs) || typeof refs !== 'object') throw new Error('Invalid references');
    validateReferences(snapshot, target, refs);
    const decision = policyDecision && freeze(structuredClone(policyDecision));
    const scope = decision?.actor_scope;
    const action = `${entity.kind}:${entity.state}:${target}`;
    if (!decision || typeof verifyPolicyDecision !== 'function' || !policyVersion
        || decision.outcome !== 'ALLOW' || decision.policy_version !== policyVersion
        || decision.entity_id !== entity.id || decision.entity_kind !== entity.kind
        || decision.entity_revision !== entity.revision || decision.from_state !== entity.state
        || decision.to_state !== target || decision.entity_digest !== snapshotDigest(snapshot)
        || decision.references_digest !== snapshotDigest(refs)
        || scope?.actor_id !== actor.id || scope?.actor_kind !== actor.kind || scope?.action !== action) {
      throw new Error('Missing or mismatched trusted policy decision');
    }
    assertId(decision.decision_id);
    if (decision.expires_at !== undefined
        && (typeof decision.expires_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(decision.expires_at)
          || !Number.isFinite(Date.parse(decision.expires_at)) || Date.parse(decision.expires_at) <= instant.getTime())) {
      throw new Error('Policy decision expired or expiry invalid');
    }
    const facts = freeze({ entity: snapshot, target, actor: structuredClone(actor), references: refs, at: instant.toISOString() });
    if (verifyPolicyDecision(decision, facts) !== true) throw new Error('Unverified policy decision');
    if (entity.kind === 'release' && ['FROZEN_FOR_REVIEW','APPROVED','PUBLISHED'].includes(target)
        && (typeof verifyReleaseRights !== 'function' || verifyReleaseRights(facts) !== true)) {
      throw new Error('Release rights gate denied');
    }
    const event = {
      id: newId(), entityId: entity.id, entityKind: entity.kind,
      actor: structuredClone(actor), reason: reason.trim(), correlationId,
      at: instant.toISOString(), previousState: entity.state, newState: target,
      previousRevision: entity.revision, newRevision: entity.revision + 1,
      decisionId: decision.decision_id, policyVersion: decision.policy_version, references: refs,
    };
    return freeze({ entity: { ...snapshot, state: target, revision: event.newRevision }, event });
  };
}

// Fail-closed convenience export. An application must explicitly configure its
// trusted policy adapter with createTransitionEngine before transitions can pass.
export const transition = createTransitionEngine();
