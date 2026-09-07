import test from 'node:test';
import assert from 'node:assert/strict';
import { newId, assertId, validateClassification, transition } from '../packages/domain/index.mjs';

const human = { id: newId(), kind: 'human' };
const ai = { id: newId(), kind: 'ai' };
const move = (entity, target, actor = human) => transition(entity, target, { actor, reason: 'Synthetic test' });

test('internal ID does not depend on FDI notation', () => {
  const structure = { id: newId(), notations: { FDI: '36' } };
  const revised = { ...structure, notations: { ...structure.notations, Universal: '19' } };
  assert.equal(assertId(revised.id), structure.id);
  assert.throws(() => assertId('36'));
});

test('E3 accepted variant remains a variant', () => {
  const value = { anatomicalClass: 'variant', evidenceGrade: 'E3_INDEPENDENTLY_VERIFIED', consensusState: 'accepted' };
  assert.equal(validateClassification(value).anatomicalClass, 'variant');
  assert.throws(() => validateClassification({ ...value, evidenceGrade: 'clinical-proof' }));
});

test('issue reclassification returns immutable new state and audit, preserving old issue', () => {
  const original = { id: newId(), kind: 'issue', state: 'UNDER_REVIEW', revision: 3, text: 'May be wrong' };
  const result = move(original, 'RECLASSIFIED_AS_VARIANT');
  assert.equal(original.state, 'UNDER_REVIEW');
  assert.equal(result.entity.id, original.id);
  assert.equal(result.entity.text, original.text);
  assert.equal(result.entity.revision, 4);
  assert.equal(result.event.previousState, 'UNDER_REVIEW');
  assert.throws(() => { result.entity.text = 'erase'; }, TypeError);
  assert.throws(() => move(original, 'CLOSED'));
});

test('AI patch must pass QC and stop at human review', () => {
  const generated = { id: newId(), kind: 'patch', state: 'GENERATED', revision: 1 };
  const pending = move(generated, 'AWAITING_HUMAN_REVIEW', ai).entity;
  assert.throws(() => move(pending, 'APPROVED', ai), /Human/);
  assert.throws(() => move(generated, 'MERGED_INTO_RELEASE', ai));
  assert.equal(move(pending, 'REJECTED').entity.state, 'REJECTED');
});

test('publication requires human actor; published release cannot return to draft', () => {
  const release = { id: newId(), kind: 'release', state: 'APPROVED', revision: 2, manifest: { assets: ['synthetic'] } };
  assert.throws(() => move(release, 'PUBLISHED', ai), /Human/);
  const published = move(release, 'PUBLISHED').entity;
  assert.throws(() => move(published, 'DRAFT'));
  const withdrawn = move(published, 'WITHDRAWN');
  assert.deepEqual(withdrawn.entity.manifest, published.manifest);
  assert.equal(published.state, 'PUBLISHED');
});

test('disagreement is representable and old claim must be superseded', () => {
  const claim = { id: newId(), kind: 'claim', state: 'under_review', revision: 0 };
  assert.equal(move(claim, 'disputed').entity.state, 'disputed');
  const accepted = move(claim, 'accepted').entity;
  assert.throws(() => move(accepted, 'proposed'));
  assert.equal(move(accepted, 'superseded').entity.state, 'superseded');
});

test('invalid actors, audit omissions and unknown states fail', () => {
  const issue = { id: newId(), kind: 'issue', state: 'OPEN', revision: 0 };
  assert.throws(() => transition(issue, 'TRIAGE', { actor: human, reason: '' }));
  assert.throws(() => move(issue, 'TRIAGE', { ...human, kind: 'unknown' }));
  assert.throws(() => move({ ...issue, state: 'toString' }, 'TRIAGE'));
});
