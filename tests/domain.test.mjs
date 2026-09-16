import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newId, assertId, validateClassification, createTransitionEngine, transition,
  snapshotDigest, transitions, reviewDecisions,
} from '../packages/domain/index.mjs';

const NOW = new Date('2026-09-16T12:00:00.000Z');
const human = { id: 'reviewer-internal-id', kind: 'human' };
const ai = { id: 'worker-ai-id', kind: 'ai' };
const system = { id: 'worker-system-id', kind: 'system' };
const refs = {
  successor_id: 'successor', duplicate_issue_id: 'other-issue', claim_id: 'claim',
  variant_id: 'variant', patch_id: 'patch', release_id: 'release',
  resolution_event_id: 'resolution', evidence_id: 'evidence',
};
const entity = (kind, state) => ({ id: newId(), kind, state, revision: 2 });

// Synthetic server-side issuer: decisions must be present and unchanged in its
// private registry. A fabricated client-shaped ALLOW object is insufficient.
function fixture() {
  const registry = new Map();
  const run = createTransitionEngine({
    policyVersion: 'test-policy-v1', clock: () => NOW,
    verifyPolicyDecision: d => registry.get(d.decision_id) === JSON.stringify(d),
  });
  const issue = (e, to, actor = human, references = refs, extra = {}) => {
    const d = {
      decision_id: newId(), outcome: 'ALLOW', policy_version: 'test-policy-v1',
      entity_id: e.id, entity_kind: e.kind, entity_revision: e.revision,
      from_state: e.state, to_state: to, entity_digest: snapshotDigest(e),
      references_digest: snapshotDigest(references),
      actor_scope: { actor_id: actor.id, actor_kind: actor.kind, action: `${e.kind}:${e.state}:${to}` },
      expires_at: '2026-09-16T13:00:00.000Z', ...extra,
    };
    registry.set(d.decision_id, JSON.stringify(d));
    return d;
  };
  const options = (e, to, actor = human, references = refs, extra = {}) => ({
    actor, references, reason: 'Synthetic test decision', correlationId: 'test-request',
    policyDecision: issue(e, to, actor, references, extra),
  });
  return { run, options };
}

// Independent expected contract, reviewed against the design table.
const expected = {
  issue: {
    DRAFT: ['OPEN'], OPEN: ['TRIAGE'],
    TRIAGE: ['NEEDS_EVIDENCE', 'UNDER_REVIEW', 'DUPLICATE', 'INVALID_SPAM'],
    NEEDS_EVIDENCE: ['UNDER_REVIEW'],
    UNDER_REVIEW: ['ACCEPTED_AS_CORRECTION', 'RECLASSIFIED_AS_VARIANT', 'DISPUTED', 'REJECTED', 'SUPERSEDED'],
    DISPUTED: ['UNDER_REVIEW', 'SUPERSEDED'], ACCEPTED_AS_CORRECTION: ['RESOLVED'],
    RECLASSIFIED_AS_VARIANT: ['RESOLVED'], DUPLICATE: ['CLOSED'], INVALID_SPAM: ['CLOSED'],
    REJECTED: ['CLOSED'], SUPERSEDED: ['CLOSED'], RESOLVED: ['CLOSED'], CLOSED: [],
  },
  claim: {
    proposed: ['under_review'], under_review: ['accepted', 'disputed', 'rejected'],
    accepted: ['disputed', 'superseded'], disputed: ['under_review', 'superseded'],
    rejected: ['superseded'], superseded: [],
  },
  patch: {
    REQUESTED: ['GENERATING'], GENERATING: ['GENERATED'],
    GENERATED: ['QC_FAILED', 'AWAITING_HUMAN_REVIEW'], QC_FAILED: ['SUPERSEDED'],
    AWAITING_HUMAN_REVIEW: ['APPROVED', 'CHANGES_REQUESTED', 'REJECTED'],
    CHANGES_REQUESTED: ['SUPERSEDED'], APPROVED: ['MERGED_INTO_RELEASE', 'SUPERSEDED'],
    REJECTED: ['SUPERSEDED'], MERGED_INTO_RELEASE: [], SUPERSEDED: [],
  },
  release: {
    DRAFT: ['FROZEN_FOR_REVIEW'], FROZEN_FOR_REVIEW: ['APPROVED', 'SUPERSEDED'],
    APPROVED: ['PUBLISHED', 'SUPERSEDED'], PUBLISHED: ['WITHDRAWN', 'SUPERSEDED'],
    WITHDRAWN: [], SUPERSEDED: [],
  },
};

for (const [kind, graph] of Object.entries(expected)) {
  test(`${kind}: complete allowed/forbidden transition matrix`, () => {
    assert.deepEqual(Object.keys(transitions[kind]).sort(), Object.keys(graph).sort());
    const { run, options } = fixture();
    let count = 0;
    for (const [from, allowed] of Object.entries(graph)) {
      for (const to of Object.keys(graph)) {
        const e = entity(kind, from);
        if (allowed.includes(to)) {
          const r = run(e, to, options(e, to));
          assert.equal(r.entity.state, to);
          assert.equal(r.entity.revision, e.revision + 1);
          assert.equal(e.state, from);
        } else assert.throws(() => run(e, to, options(e, to)), /Invalid state transition/);
        count++;
      }
    }
    console.log(`MATRIX ${kind}: ${count} pairs; ${Object.values(graph).flat().length} allowed`);
  });
}

test('ID is opaque; current generator uses UUID v4 independently from notation', () => {
  assert.match(newId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab]/);
  assert.equal(assertId('opaque-future-format'), 'opaque-future-format');
  for (const invalid of ['', ' ', ' id', null, 36, 'id\n']) assert.throws(() => assertId(invalid));
  const structure = { id: newId(), notations: { FDI: '36' } };
  assert.equal({ ...structure, notations: { Universal: '19' } }.id, structure.id);
});

test('claim classification remains orthogonal and independent of any asset', () => {
  const { run, options } = fixture();
  const e = { ...entity('claim', 'under_review'), anatomicalClass: 'variant', evidenceGrade: 'E3_INDEPENDENTLY_VERIFIED' };
  validateClassification({ ...e, consensusState: 'accepted' });
  const r = run(e, 'accepted', options(e, 'accepted'));
  assert.equal(r.entity.anatomicalClass, 'variant');
  assert.equal(r.entity.evidenceGrade, 'E3_INDEPENDENTLY_VERIFIED');
  assert.equal('asset' in r.entity, false);
  assert.throws(() => validateClassification({ ...e, consensusState: 'accepted', evidenceGrade: 'clinical-proof' }));
  assert.deepEqual(reviewDecisions, ['APPROVE', 'REQUEST_CHANGES', 'REJECT', 'ABSTAIN']);
});

test('human without trusted policy decision cannot transition', () => {
  const { run, options } = fixture();
  const e = entity('release', 'APPROVED');
  const valid = options(e, 'PUBLISHED');
  assert.throws(() => run(e, 'PUBLISHED', { ...valid, policyDecision: undefined }), /policy/);
  assert.throws(() => run(e, 'PUBLISHED', { ...valid, policyDecision: { approved: true, role: 'admin' } }), /policy/);
  assert.throws(() => transition(e, 'PUBLISHED', valid), /policy/);
  assert.throws(() => run(e, 'PUBLISHED', { ...valid, policyDecision: { ...valid.policyDecision, decision_id: newId() } }), /Unverified/);
});

test('all policy bindings, denied outcomes and expired decisions fail closed', () => {
  const { run, options } = fixture();
  const e = entity('release', 'APPROVED');
  const mismatches = [
    { entity_id: 'other' }, { entity_kind: 'patch' }, { entity_revision: 1 },
    { from_state: 'DRAFT' }, { to_state: 'WITHDRAWN' }, { policy_version: 'old' },
    { outcome: 'DENY' }, { entity_digest: 'wrong' }, { references_digest: 'wrong' },
    { actor_scope: { actor_id: 'other', actor_kind: 'human', action: 'release:APPROVED:PUBLISHED' } },
    { actor_scope: { actor_id: human.id, actor_kind: 'ai', action: 'release:APPROVED:PUBLISHED' } },
    { actor_scope: { actor_id: human.id, actor_kind: 'human', action: 'issue:OPEN:TRIAGE' } },
    { expires_at: '2026-09-16T12:00:00.000Z' }, { expires_at: 'invalid' },
    { decision_id: '' },
  ];
  for (const bad of mismatches) assert.throws(() => run(e, 'PUBLISHED', options(e, 'PUBLISHED', human, refs, bad)));
});

test('AI and system cannot perform human-only decisions, even with issued ALLOW', () => {
  const { run, options } = fixture();
  let checks = 0;
  for (const [kind, graph] of Object.entries(expected)) {
    for (const [from, targets] of Object.entries(graph)) {
      for (const to of targets) {
        const protectedEdge = kind === 'release'
          || (kind === 'issue' && to !== 'OPEN')
          || (kind === 'claim' && to !== 'under_review')
          || (kind === 'patch' && ['APPROVED','CHANGES_REQUESTED','REJECTED','MERGED_INTO_RELEASE','SUPERSEDED'].includes(to));
        if (!protectedEdge) continue;
        for (const actor of [ai, system]) {
          const e = entity(kind, from);
          assert.throws(() => run(e, to, options(e, to, actor)), /Human decision required/);
          checks++;
        }
      }
    }
  }
  console.log(`HUMAN-ONLY: ${checks} AI/system rejection cases`);
});

test('AI preparation can reach human review, without publishing', () => {
  const { run, options } = fixture();
  const e = entity('patch', 'GENERATED');
  assert.equal(run(e, 'AWAITING_HUMAN_REVIEW', options(e, 'AWAITING_HUMAN_REVIEW', ai)).entity.state, 'AWAITING_HUMAN_REVIEW');
  assert.throws(() => run(e, 'APPROVED', options(e, 'APPROVED', ai)), /Invalid state transition/);
});

test('state changes preserve semantics, input and immutable audit draft', () => {
  const { run, options } = fixture();
  const e = { ...entity('claim', 'accepted'), predicate: 'synthetic', value: { sample: 1 } };
  const r = run(e, 'disputed', options(e, 'disputed'));
  assert.equal(e.state, 'accepted');
  assert.deepEqual(r.entity.value, e.value);
  assert.equal(r.event.correlationId, 'test-request');
  assert.equal(r.event.at, NOW.toISOString());
  assert.equal(r.event.previousRevision, e.revision);
  assert.equal(r.event.newRevision, e.revision + 1);
  assert.equal(r.event.actor.id, human.id);
  assert.ok(r.event.decisionId);
  assert.throws(() => { r.entity.value.sample = 2; }, TypeError);
  assert.throws(() => { r.event.actor.id = 'other'; }, TypeError);
});

test('frozen release replacement preserves old manifest and requires new identity', () => {
  const { run, options } = fixture();
  const old = { ...entity('release', 'FROZEN_FOR_REVIEW'), manifest: { assets: ['v1'] } };
  const replacement = { ...entity('release', 'DRAFT'), manifest: { assets: ['v2'] }, supersedes_release_id: old.id };
  const links = { ...refs, successor_id: replacement.id };
  const r = run(old, 'SUPERSEDED', options(old, 'SUPERSEDED', human, links));
  assert.deepEqual(r.entity.manifest, { assets: ['v1'] });
  assert.notEqual(replacement.id, old.id);
  const approval = options(old, 'APPROVED');
  assert.throws(() => run({ ...old, manifest: replacement.manifest }, 'APPROVED', approval), /policy/);
  assert.throws(() => run(old, 'DRAFT', options(old, 'DRAFT')), /Invalid state transition/);
});

test('required resolution/supersession references are enforced and bound', () => {
  const { run, options } = fixture();
  for (const [kind, from, to] of [
    ['issue','UNDER_REVIEW','RECLASSIFIED_AS_VARIANT'], ['issue','RESOLVED','CLOSED'],
    ['claim','accepted','superseded'], ['patch','APPROVED','MERGED_INTO_RELEASE'],
    ['release','FROZEN_FOR_REVIEW','SUPERSEDED'],
  ]) {
    const e = entity(kind, from);
    assert.throws(() => run(e, to, options(e, to, human, {})));
    const opts = options(e, to);
    assert.throws(() => run(e, to, { ...opts, references: { ...refs, successor_id: 'swapped' } }), /policy/);
  }
  const e = entity('claim', 'accepted');
  const self = { ...refs, successor_id: e.id };
  assert.throws(() => run(e, 'superseded', options(e, 'superseded', human, self)), /Self reference/);
});

test('closed issue stays terminal; new evidence uses new issue linked to the old', () => {
  const old = entity('issue', 'CLOSED');
  const next = { ...entity('issue', 'DRAFT'), prior_issue_id: old.id };
  const { run, options } = fixture();
  assert.throws(() => run(old, 'OPEN', options(old, 'OPEN')), /Invalid state transition/);
  assert.equal(run(next, 'OPEN', options(next, 'OPEN')).entity.prior_issue_id, old.id);
  assert.notEqual(old.id, next.id);
});

test('unknown states, missing audit data and revision overflow are rejected', () => {
  const { run, options } = fixture();
  const e = entity('issue', 'OPEN');
  const opts = options(e, 'TRIAGE');
  for (const bad of [{ reason: '' }, { correlationId: '' }, { actor: { ...human, kind: 'unknown' } }]) {
    assert.throws(() => run(e, 'TRIAGE', { ...opts, ...bad }));
  }
  for (const revision of [-1, 0.5, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1]) {
    const bad = { ...e, revision };
    assert.throws(() => run(bad, 'TRIAGE', options(bad, 'TRIAGE')), /Invalid revision/);
  }
  for (const bad of [{ ...e, state: 'toString' }, { ...e, kind: '__proto__' }]) {
    assert.throws(() => run(bad, 'TRIAGE', options(bad, 'TRIAGE')), /Invalid state transition/);
  }
});

test('untrusted or asynchronous verifier result does not grant permission', () => {
  const { options } = fixture();
  const e = entity('issue', 'OPEN');
  for (const verifyPolicyDecision of [() => false, () => undefined, () => 'true', () => Promise.resolve(true)]) {
    const run = createTransitionEngine({ policyVersion: 'test-policy-v1', clock: () => NOW, verifyPolicyDecision });
    assert.throws(() => run(e, 'TRIAGE', options(e, 'TRIAGE')), /Unverified/);
  }
});
