import { randomUUID } from 'node:crypto';

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
export const newId = () => randomUUID();
export function assertId(id) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('A notation-independent UUID v4 is required');
  }
  return id;
}

export function validateClassification(value) {
  if (!anatomicalClasses.includes(value.anatomicalClass)
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
    disputed: ['under_review', 'superseded'], accepted: ['superseded'],
    rejected: ['superseded'], superseded: [],
  },
  patch: {
    REQUESTED: ['GENERATING'], GENERATING: ['GENERATED', 'QC_FAILED'],
    GENERATED: ['QC_FAILED', 'AWAITING_HUMAN_REVIEW'],
    QC_FAILED: ['SUPERSEDED'], AWAITING_HUMAN_REVIEW: ['APPROVED', 'CHANGES_REQUESTED', 'REJECTED'],
    CHANGES_REQUESTED: ['SUPERSEDED'], APPROVED: ['MERGED_INTO_RELEASE', 'SUPERSEDED'],
    REJECTED: ['SUPERSEDED'], MERGED_INTO_RELEASE: [], SUPERSEDED: [],
  },
  release: {
    DRAFT: ['FROZEN_FOR_REVIEW'], FROZEN_FOR_REVIEW: ['APPROVED'],
    APPROVED: ['PUBLISHED'], PUBLISHED: ['WITHDRAWN', 'SUPERSEDED'],
    WITHDRAWN: [], SUPERSEDED: [],
  },
});

const humanDecisions = new Set([
  'ACCEPTED_AS_CORRECTION', 'RECLASSIFIED_AS_VARIANT', 'DISPUTED', 'REJECTED',
  'accepted', 'disputed', 'rejected', 'APPROVED', 'CHANGES_REQUESTED',
  'MERGED_INTO_RELEASE', 'PUBLISHED', 'WITHDRAWN',
]);

// Pure domain primitive. Callers MUST independently authorize the actor, evaluate
// rights/privacy/quorum and atomically persist the new state and returned event.
// Actor and policy facts must come from trusted server context, never request JSON.
export function transition(entity, target, { actor, reason, at = new Date().toISOString() }) {
  assertId(entity.id);
  assertId(actor?.id);
  if (!['human', 'ai', 'system'].includes(actor.kind)) throw new Error('Unknown actor kind');
  if (typeof reason !== 'string' || !reason.trim()) throw new Error('An audit reason is required');
  if (!Number.isFinite(Date.parse(at))) throw new Error('Invalid event timestamp');
  if (!Object.hasOwn(transitions, entity.kind)
      || !Object.hasOwn(transitions[entity.kind], entity.state)
      || !transitions[entity.kind][entity.state].includes(target)) {
    throw new Error('Invalid state transition');
  }
  if (actor.kind !== 'human' && humanDecisions.has(target)) throw new Error('Human decision required');
  if (!Number.isSafeInteger(entity.revision) || entity.revision < 0) throw new Error('Invalid revision');
  const snapshot = structuredClone(entity);
  const event = {
    id: newId(), entityId: entity.id, entityKind: entity.kind,
    actor: structuredClone(actor), reason: reason.trim(), at,
    previousState: entity.state, newState: target,
    previousRevision: entity.revision, newRevision: entity.revision + 1,
  };
  return freeze({ entity: { ...snapshot, state: target, revision: event.newRevision }, event });
}
