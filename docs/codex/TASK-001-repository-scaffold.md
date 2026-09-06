# TASK-001 — Repository Scaffold + Architecture Guards

## Objective
Create the monorepo directory skeleton and repository-level safety/documentation guards. Do **not** implement product features.

## Read first
`docs/architecture/DENTAL_KNOWLEDGE_BASE_ARCHITECTURE_v0.1.md`

Architecture v0.1 is normative.

## Create
```text
apps/web/
apps/review-portal/
services/api/
services/worker/
services/quarantine/
packages/domain/
packages/contracts/
packages/db/
packages/ontology/
packages/mesh-pipeline/
packages/rights/
packages/review-engine/
packages/audit/
docs/licensing/
docs/privacy/
infra/
```

## Required guards
1. `.gitignore` rejects common DICOM/raw clinical data patterns and local quarantine directories.
2. Add `docs/privacy/NO_CLINICAL_DATA_IN_GIT.md`.
3. Add `docs/licensing/ASSET_RIGHTS_POLICY.md` pointing back to Architecture v0.1.
4. Add CI or script guard that fails if obvious restricted clinical files/directories are committed.
5. No real patient fixtures. Synthetic only.

## Deferred choices
Do not freeze without ADR:
- ORM
- queue
- graph DB
- cloud vendor
- object storage vendor
- AI provider
- auth provider

## Acceptance
- repository bootstrap checks cleanly
- clinical-data Git guard has positive and negative synthetic tests
- architecture doc unchanged except typo fixes
- no feature logic
- no DB schema yet
- no 3D viewer yet

## PR title
`chore: scaffold DentalKnowledgeBase repository`
