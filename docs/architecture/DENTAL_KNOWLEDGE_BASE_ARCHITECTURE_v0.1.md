# Dental Knowledge Base Architecture v0.1

**Repository:** `dental-knowledge-base`  
**Project name:** DentalKnowledgeBase  
**Status:** Architecture baseline / pre-implementation  
**Date:** 2026-09-06  
**Audience:** maintainers, academic reviewers, contributors, Astra/Codex agents

## 0. Normative language

The terms **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are normative within this specification.

This document is the architecture baseline. Code, schema, APIs, AI-generated patches and UI behavior MUST conform to it unless superseded by an accepted Architecture Decision Record (ADR).

## 1. Mission

DentalKnowledgeBase is an open, education-first dental anatomy knowledge system.

It is **not** merely a 3D atlas. The core product is a versioned evidence and knowledge-management engine linking anatomical structures, canonical representations, variants, specimens, 3D/2D/volumetric assets, scientific claims, evidence, issues, qualified academic review, AI-assisted patch proposals, licenses, provenance and immutable release history.

Multiple clients MAY consume this core later: web atlas, review portal, mobile learning app, VR/AR, research API, curriculum tools and assessment systems.

## 2. Product principles

1. **AI is not the source of anatomical truth.** AI MAY research, transform, propose, code, segment, generate metadata, run QC and prepare patches. It MUST NOT directly publish scientific or anatomical changes.
2. **Nothing important is silently overwritten.** Source assets, issues, claims, review decisions, rights records and releases MUST preserve history.
3. **“Wrong” and “variant” are different outcomes.** An issue reported as an error MAY become a valid variant, developmental state, pathological state, disputed claim or insufficient-evidence observation.
4. **One specimen does not define a population.** A single observation MUST NOT be labeled as sex-associated, age-group-specific, population-specific or prevalence-bearing without supporting evidence.
5. **Rights are data.** Every publishable asset MUST have an explicit rights/provenance record.
6. **Clinical raw data is a separate trust zone.** Human-derived DICOM/CBCT/radiographic data MUST enter quarantine/de-identification and MUST NOT be committed to Git.
7. **Open by design, not careless by design.** Prefer open licenses compatible with future sponsorship/advertising.
8. **Academic disagreement is preservable knowledge.** Accepted dissent, superseded views and rejected claims MUST remain in history.
9. **Internal identifiers are stable.** External ontologies and standards are mappings, not primary keys.
10. **Claims, evidence, consensus and representation are separate.** A mesh is a representation, not proof.

## 3. Scope

### 3.1 Initial educational scope

- permanent and primary tooth morphology
- enamel, dentin, cementum
- pulp chambers and root canal systems
- periodontium
- maxilla and mandible
- TMJ and muscles of mastication
- oral cavity, tongue, salivary glands
- relevant cranial nerves and major vessels
- local-anesthesia anatomy
- radiographic anatomical correlations
- developmental states
- documented anatomical variants

### 3.2 Explicit non-goals for v0.x

The project MUST NOT initially provide diagnosis, treatment recommendations, patient-specific surgical planning, medical-device claims, automatic clinical decision support, public raw-patient-image publication or unsupervised AI publication.

Public-facing language SHOULD state that the platform is for education/research and not diagnosis or treatment.

## 4. Repository architecture

```text
dental-knowledge-base/
├── apps/
│   ├── web/                    # Public 3D atlas / education client
│   └── review-portal/          # Academic review and contribution UI
├── services/
│   ├── api/                    # Core API
│   ├── worker/                 # QC, transforms, indexing, jobs
│   └── quarantine/             # Isolated clinical-data ingestion boundary
├── packages/
│   ├── domain/                 # Domain types, invariants, state machines
│   ├── contracts/              # API/event schemas
│   ├── db/                     # PostgreSQL schema/migrations/repositories
│   ├── ontology/               # FMA/Uberon/OHD/ISO mapping helpers
│   ├── mesh-pipeline/          # Geometry QC, transforms, LOD, packaging
│   ├── rights/                 # License/permission policy evaluation
│   ├── review-engine/          # Eligibility, quorum, consensus
│   └── audit/                  # Append-only audit/event helpers
├── docs/
│   ├── architecture/
│   ├── adr/
│   ├── licensing/
│   ├── privacy/
│   └── codex/
└── infra/
```

### 4.1 Technology baseline

- Core operational database: **PostgreSQL**.
- A graph database MUST NOT be required for v0.x.
- RDF/OWL/JSON-LD export MAY be added later.
- 3D public delivery SHOULD use glTF/GLB.
- Compression MUST be abstracted (`compression_codec`), not hard-wired to Draco.
- meshopt-compatible encodings MAY be used.
- KTX2/Basis-compatible textures MAY be used where appropriate.
- Binary assets SHOULD live in object storage/CDN; PostgreSQL stores metadata and references.
- Raw human-derived clinical data MUST NOT be stored in public object storage.
- ORM, queue, auth, cloud and frontend framework choices are intentionally deferred.

## 5. Core domain model

Minimum production domain:

1. `institutions`
2. `contributors`
3. `contributor_credentials`
4. `roles`
5. `role_bindings`
6. `structures`
7. `terminology_mappings`
8. `claims`
9. `variants`
10. `specimens`
11. `assets`
12. `asset_derivations`
13. `asset_rights`
14. `asset_transforms`
15. `mesh_qc_runs`
16. `issues`
17. `issue_annotations`
18. `evidence`
19. `citations`
20. `review_assignments`
21. `review_decisions`
22. `contribution_agreements`
23. `deidentification_jobs`
24. `privacy_reviews`
25. `ai_patch_bundles`
26. `releases`
27. `audit_events`

Additional join tables MAY be introduced rather than forcing overloaded foreign keys.

## 6. Stable identifiers

All internal objects MUST receive immutable internal IDs independent of external vocabularies.

Examples:

```text
STR-TOOTH-PERM-37
VAR-37-CANAL-C-0001
CLAIM-000284
ASSET-000982
SPEC-001248
ISSUE-000428
PATCH-000982
REL-2026-0001
```

Human-friendly IDs MAY differ from database UUID/ULID primary keys. External terminology IDs MUST NOT be used as database primary keys.

## 7. Anatomical structure model

`structures` represents stable anatomical concepts, not individual files.

Minimum concepts include internal identifier, canonical English name, optional Turkish/Latin labels, parent structure, structure category, dentition, tooth identity independent of notation, laterality and lifecycle status.

Internal tooth identity MUST be notation-independent.

Mappings MAY include:

- FDI / ISO 3950
- Universal
- Palmer
- future ISO revisions

Current project baseline records ISO 3950:2016 with explicit version metadata rather than assuming the notation standard never changes.

Developmental and supernumerary mappings SHOULD be able to reference ISO 5365:2024 and ISO 10394:2023 metadata where appropriate.

## 8. Terminology and ontology mappings

Core internal IDs remain authoritative.

Mappings MAY include:

- FMA — human anatomical concepts
- Uberon — broader anatomical interoperability
- OHD — oral-health/dental semantic concepts
- ISO identifiers/notation metadata
- SNOMED CT — optional external mapping only where licensing/usage permits

### 8.1 SNOMED rule

SNOMED CT MUST NOT be a runtime or data-model dependency for v0.x.

If SNOMED mappings are later stored or distributed, the project MUST first verify current licensing requirements for the deployment jurisdiction and distribution model.

### 8.2 Ontology license rule

Open ontology mappings MUST retain required attribution/license metadata.

“Open licensed” MUST NOT be described as “copyright free” unless the source is actually public domain/CC0.

ISO standards are references/standards metadata; ISO standard text MUST NOT be copied into the project as if it were open ontology content.

## 9. CLAIM: scientific assertion model

`claims` is central.

A claim is a structured scientific assertion that can be supported, disputed, superseded or rejected independently of any mesh.

Recommended fields:

- `subject_structure_id`
- `predicate`
- `object_structure_id` or typed value
- `claim_type`
- `anatomical_class`
- `population_scope`
- `age_scope`
- `sex_scope`
- `developmental_scope`
- `geographic_scope`
- `evidence_grade`
- `consensus_state`
- `supersedes_claim_id`
- timestamps and author

Example:

```text
subject: STR-TOOTH-PERM-37
predicate: has_root_canal_configuration
value: C_SHAPED
anatomical_class: variant
evidence_grade: E2
consensus_state: accepted
```

### 9.1 Orthogonal axes

These MUST remain separate.

**Anatomical class**

- `canonical`
- `variant`
- `developmental`
- `pathological`
- `unknown`

**Internal evidence grade**

- `E0_OBSERVATION`
- `E1_REPLICATED_OBSERVATION`
- `E2_LITERATURE_SUPPORTED`
- `E3_INDEPENDENTLY_VERIFIED`

**Consensus state**

- `proposed`
- `under_review`
- `accepted`
- `disputed`
- `rejected`
- `superseded`

E0–E3 is an **internal editorial scale**, not an international clinical evidence standard.

## 10. Variant model

A variant MUST link to one or more claims and MAY link to specimens/assets.

A variant MAY be highly verified (`E3`) while remaining a `variant`; E3 MUST NOT imply canonical anatomy.

A variant MUST NOT be assigned demographic/population prevalence from a single observation.

Recommended metadata includes variant type, target structure, supporting claims, observed specimen count, evidence summary, nullable prevalence estimate, prevalence population definition, prevalence sources, review state and superseded-by relation.

## 11. Evidence and citations

`evidence` MUST describe what kind of evidence is being offered.

Possible evidence types:

- physical specimen
- CBCT
- micro-CT
- intraoral scan
- radiograph
- histology
- peer-reviewed publication
- textbook/reference
- open dataset
- expert observation
- derived measurement

Metadata SHOULD include, where applicable, study design, sample size, imaging modality, target population, DOI/PMID/source identifier, peer-review status, measurement/annotation method and limitations.

`citations` SHOULD normalize bibliographic references so multiple claims/issues can cite the same source.

## 12. Specimens and contributions

`specimens` represents source observations, not necessarily public assets.

`specimen_origin` examples:

- `physical_extracted_tooth`
- `micro_ct`
- `cbct`
- `intraoral_scan`
- `radiograph`
- `histology`
- `synthetic`
- `published_dataset`

Required distinctions:

- `human_derived`
- `privacy_classification`
- `consent_or_authority_basis`
- `ethics_reference` where applicable
- `institution`
- `raw_data_retention_policy`
- `public_derivative_allowed`

### 12.1 Contribution channels

There MUST be separate contribution flows.

**A. Non-clinical/digital asset contribution**

Examples: contributor-owned STL/GLB, authored diagram, synthetic dataset, literature annotation.

**B. Human-derived/clinical contribution**

Examples: DICOM/CBCT, radiographs, intraoral scans and other patient-derived data.

Channel B MUST enter quarantine and privacy review.

## 13. Rights Registry

Every asset eligible for publication MUST have an `asset_rights` decision.

### 13.1 Preferred policy

Preferred for core/public assets:

- CC0 / public domain
- CC BY 4.0
- other explicitly compatible licenses after review

CC BY-SA MAY be accepted only when share-alike obligations are understood and technically compatible with the derivative/distribution path.

### 13.2 Restricted policy

The following MUST NOT enter the unrestricted core library merely because they are available:

- CC BY-NC / CC BY-NC-SA
- ND licenses where modification is required
- assets with unclear/unknown license
- purchased assets whose license does not permit required public web display or derivatives

An NC asset MAY only be used if a separate explicit permission/license grants the project the required rights independent of the NC restriction.

### 13.3 Purchased/licensed assets

“Purchased” is not a sufficient rights status.

Rights MUST be represented separately:

- public web display
- modification/derivative creation
- internal processing
- redistribution
- end-user download
- sublicensing if any
- attribution requirements
- expiration/territory restrictions
- permission document or invoice/reference

### 13.4 Contributor rights

For contributor-owned material, the project SHOULD use a clear contribution agreement:

- contributor retains copyright unless explicitly transferred
- contributor confirms authority to contribute
- project receives defined publication/derivative rights
- public open contribution SHOULD prefer CC BY 4.0 where appropriate
- institutional ownership/approval MUST be respected

Human-derived clinical data MUST NOT be automatically assigned an open-content license merely because a contributor uploaded it.

## 14. Asset model and lineage

`assets` stores metadata for files/volumes/models.

Binary file history MUST be immutable-by-derivation:

```text
source asset
   ↓
processing job
   ↓
derived asset
   ↓
LOD/packaged assets
```

Automated repair MUST NOT mutate the source asset.

`asset_derivations` SHOULD record parent asset, child asset, job type, software/tool version, parameters/recipe, AI model if involved, operator, timestamps and QC before/after.

## 15. Spatial engine

Every spatial asset MUST distinguish:

1. `SOURCE_SPACE` — original scanner/CAD/file coordinates.
2. `ANATOMICAL_SPACE` — position within jaw/head/maxillofacial reference.
3. `LOCAL_STRUCTURE` — standardized local frame for a tooth or structure.

A single transform matrix is insufficient for provenance. `asset_transforms` SHOULD store:

- source units
- coordinate convention
- handedness
- source/target spaces
- 4×4 transformation matrix
- registration method
- reference landmarks
- registration error metric(s)
- operator/software version
- timestamp

### 15.1 Tooth local axes

Tooth axes SHOULD be expressed anatomically:

- coronal ↔ apical
- mesial ↔ distal
- buccal/labial ↔ lingual/palatal

A naive global rule such as “mesial is always +X” MUST NOT be assumed across mirrored left/right teeth without an explicit orientation convention.

## 16. Mesh Quality Gate

QC MUST be profile-based.

Asset profiles:

- `SOLID`
- `SHEET`
- `CURVE_TUBE`
- `VOLUME`
- additional profiles by ADR

### 16.1 Example checks

For meshes where applicable:

- non-manifold edges
- self intersections
- degenerate triangles
- duplicate vertices
- inverted/flipped normals
- disconnected components
- unit/scale anomalies
- bounding-box anomalies
- surface area/volume
- topology profile compliance
- source-to-derived geometric deviation
- LOD deviation

A `SHEET` asset MUST NOT fail merely because it is not watertight.

### 16.2 LOD

Public mesh assets SHOULD support LOD where useful.

Prototype engineering levels MAY start with:

- LOD0: review/master web detail
- LOD1: medium detail
- LOD2: overview detail

The pipeline MUST calculate and record geometric deviation from the reviewed source. Final medical/educational tolerances MUST be determined with domain reviewers and documented by ADR; they MUST NOT be inferred solely from graphics convenience.

### 16.3 Compression

Compression is a deployment detail:

- `compression_codec` MUST be configurable metadata.
- Draco MUST NOT be a domain invariant.
- meshopt-compatible encodings MAY be used.
- KTX2/Basis MAY be used for textures.

## 17. Issue system

Any authenticated user MAY be allowed to open an issue, subject to moderation/rate policy.

Issue opening is not academic approval.

An issue SHOULD capture:

- target structure
- target asset/version
- issue category
- description
- evidence/citation links
- 3D annotations
- viewer state snapshot
- author
- timestamps

### 17.1 Annotation anchoring

An annotation MUST NOT rely on an unversioned global XYZ point.

It SHOULD store:

- `structure_id`
- `asset_id` and exact asset revision
- local-structure-space coordinate
- optional triangle/face ID plus barycentric coordinates for that revision
- camera/view state
- visible layers
- annotation geometry: point/line/area/measurement
- migration status if a later mesh replaces the asset

After remeshing, annotations MUST NOT be silently remapped without recording the remapping process/confidence.

### 17.2 Issue lifecycle

```text
DRAFT
  ↓
OPEN
  ↓
TRIAGE
  ├─ NEEDS_EVIDENCE
  ├─ UNDER_REVIEW
  ├─ DUPLICATE
  └─ INVALID/SPAM
        ↓
UNDER_REVIEW
  ├─ ACCEPTED_AS_CORRECTION
  ├─ RECLASSIFIED_AS_VARIANT
  ├─ DISPUTED
  ├─ REJECTED
  └─ SUPERSEDED
        ↓
RESOLVED/CLOSED
```

Closing an issue MUST NOT delete its content/history. State transitions MUST append audit events.

## 18. Review system and reviewer eligibility

Credentials and authorization MUST be separate.

A contributor may hold a real academic credential but have no project approval authority.

`contributor_credentials` stores verified qualifications.

`role_bindings` stores project authority scoped by specialty/domain, structure group, institution if needed, action and validity dates.

Reviewers SHOULD disclose or record relevant conflicts of interest where applicable.

### 18.1 Review decisions

Minimum decisions:

- `APPROVE`
- `REQUEST_CHANGES`
- `REJECT`
- `ABSTAIN`

Each decision MUST be attributable and immutable; corrections are additional decisions/events, not destructive edits.

## 19. Consensus / quorum policy v0.1

Quorum is based on **qualified eligible reviewers**, not raw user votes.

| Change type | Minimum v0.1 quorum |
|---|---|
| Typo/non-scientific copy edit | 1 authorized editor |
| Terminology/mapping correction | 1 qualified domain editor; 2 if semantic meaning changes |
| Non-canonical minor geometry cleanup with unchanged anatomy | 2 qualified reviewers |
| New educational anatomical variant (public accepted status) | 3 qualified reviewers, preferably ≥2 institutions |
| Canonical anatomical geometry/content change | 3 qualified reviewers from ≥2 institutions + section editor approval |
| Evidence-grade promotion to E3 | 3 qualified reviewers from ≥2 institutions + independent supporting evidence |
| Privacy release of human-derived data/derivative | separate privacy reviewer approval; academic quorum does not substitute |
| Rights/license approval for restricted/purchased asset | rights reviewer/maintainer approval; academic quorum does not substitute |

Rules:

- Reviewers MUST be relevant to the claim domain.
- Three unrelated specialists do not satisfy a specialist quorum merely by count.
- Unresolved material dissent MAY result in `DISPUTED`, not forced acceptance.
- Quorum rules MUST be configurable/versioned, but changes require ADR.
- A reviewer MUST NOT approve their own AI patch as the sole required reviewer.

## 20. Evidence grade policy v0.1

### E0 — Observation

- one observation/specimen/credible report
- not sufficient for prevalence or demographic labeling

### E1 — Replicated observation

- observed in more than one independent specimen/source or independently replicated
- still may lack literature synthesis

### E2 — Literature supported

- supported by suitable published literature and/or established dataset evidence
- evidence metadata and limitations recorded

### E3 — Independently verified

- independent evidence support plus required qualified reviewer consensus
- does not imply canonical anatomy

Promotion MUST be an auditable event.

## 21. AI Patch Bundle

AI MUST NOT write directly into published canonical/variant state.

Accepted workflow:

```text
ISSUE / CLAIM
    ↓
AI task
    ↓
PATCH BUNDLE
    ↓
automated QC
    ↓
human review
    ↓
approved derived asset/content
    ↓
release
```

`ai_patch_bundles` SHOULD include:

- patch ID
- triggering issue/claim
- base asset/content versions
- newly generated derived asset IDs
- metadata diffs
- processing recipe
- model/provider identifier
- task/prompt hash or reproducible task reference
- QC results
- affected structures/lessons/questions
- status
- reviewer decisions

A binary `geometry_diff` MAY be generated for visualization but MUST NOT be the sole source of truth after topology/remeshing changes.

Recommended states:

```text
REQUESTED
GENERATING
GENERATED
QC_FAILED
AWAITING_HUMAN_REVIEW
CHANGES_REQUESTED
APPROVED
MERGED_INTO_RELEASE
REJECTED
SUPERSEDED
```

## 22. Human-derived data / privacy quarantine

The quarantine boundary MUST be separated from normal public asset ingestion.

### 22.1 Minimum pipeline

```text
UPLOAD QUARANTINE
   ↓
authority/rights check
   ↓
metadata de-identification
   ↓
burned-in pixel text detection/cleaning
   ↓
recognizable-feature analysis
   ↓
maxillofacial ROI-aware privacy processing
   ↓
human privacy review
   ↓
segmentation/derived-data creation
   ↓
academic review
   ↓
public derivative decision
```

DICOM header removal alone MUST NOT be treated as sufficient anonymization.

OCR MAY assist detection of burned-in text but MUST NOT be treated as a privacy guarantee.

For head/CBCT data, recognizable external soft-tissue features require explicit review; privacy processing MUST avoid unnecessarily destroying the maxillofacial anatomy required for the educational purpose.

### 22.2 Deduplication fingerprints

Quarantine MAY use:

- `exact_file_hmac = HMAC-SHA-256(secret, raw_bytes)`
- `normalized_content_fingerprint` for semantically identical re-exports

Raw fingerprint data MUST remain in the restricted trust zone.

### 22.3 Retention

Raw human-derived data retention MUST be explicit per specimen/data source.

Public release SHOULD prefer approved derived meshes/annotations rather than raw clinical datasets unless a separate lawful/ethical release decision exists.

No raw human-derived clinical data MAY be committed to GitHub.

## 23. Releases and immutability

A public release is a frozen manifest.

A release SHOULD identify structures, claim revisions, accepted variants, asset versions, rights decisions, ontology mapping versions, reviewer approvals, QC reports and application/schema compatibility.

Recommended release states:

```text
DRAFT
FROZEN_FOR_REVIEW
APPROVED
PUBLISHED
WITHDRAWN
SUPERSEDED
```

Published releases MUST NOT be silently mutated.

Corrections create a new release.

A withdrawal MUST preserve the prior release record and explain why it was withdrawn.

## 24. Audit model

`audit_events` is append-only at the application level.

Audit events SHOULD record:

- actor
- action
- entity type/id
- previous and new state references
- timestamp
- reason
- correlation/request ID
- automated vs human actor
- AI model/job reference when applicable

Hard-delete MUST be exceptional and restricted to legally required privacy/security operations. Domain “deletion” normally means deprecation, withdrawal, redaction or supersession.

Sensitive privacy data MUST NOT be copied into general audit logs.

## 25. Public academic transparency

Where appropriate, public pages MAY show:

- contributors
- institutions
- reviewed-by attribution scoped to the exact module/claim
- issue history
- claim/evidence summary
- model provenance
- version history
- unresolved/disputed status

The UI MUST NOT imply that an institution endorsed the entire platform merely because one contributor from that institution reviewed one structure.

## 26. Prototype v0.1 scope

The prototype MUST exercise more than rendering.

### 26.1 Required anatomy cases

1. **FDI 16 — canonical**
   - external morphology
   - internal anatomy example, including MB2 only where selected source/evidence supports it

2. **FDI 36 — canonical**
   - plus a documented three-root / Radix Entomolaris variant

3. **FDI 37 — canonical**
   - plus a documented C-shaped canal variant

The exact initial geometry source for each MUST pass Rights Registry and academic review.

### 26.2 Required end-to-end scenario

At least one issue MUST be intentionally processed through:

```text
User opens issue:
“this anatomy may be wrong”
      ↓
qualified review
      ↓
RECLASSIFIED_AS_VARIANT
      ↓
claim created/updated
      ↓
AI patch requested
      ↓
new derived asset/content produced
      ↓
QC
      ↓
human review
      ↓
approved release
      ↓
old issue/asset/history remains accessible
```

## 27. Prototype acceptance tests

The prototype is accepted only if all **P0** tests pass.

### P0 — Domain/data integrity

**AT-P0-001 — Clean bootstrap**
- Empty PostgreSQL database can be migrated from zero to current schema.
- PASS: no manual DB edits required.

**AT-P0-002 — Stable structure identity**
- FDI notation can change/mapping can be added without changing the internal structure ID.
- PASS: references remain valid.

**AT-P0-003 — Orthogonal classification**
- A variant can be stored as `anatomical_class=variant`, `evidence_grade=E3`, `consensus_state=accepted`.
- PASS: schema/state logic permits this without coercion.

**AT-P0-004 — Immutable lineage**
- Source asset is processed into a derived asset.
- PASS: source record remains unchanged and derivation edge is recorded.

**AT-P0-005 — Rights gate**
- Asset with `UNKNOWN` or incompatible rights is selected for public release.
- PASS: release is blocked.

**AT-P0-006 — NC safety**
- CC BY-NC asset without separate explicit permission is selected for unrestricted core/public release.
- PASS: release is blocked.

### P0 — Spatial/mesh

**AT-P0-010 — Three spaces**
- Prototype asset can be transformed SOURCE → ANATOMICAL → LOCAL and back using stored transform chain.
- PASS: transform metadata and numeric round-trip are reproducible within configured floating-point tolerance.

**AT-P0-011 — Profile-aware QC**
- Valid open-sheet test mesh is run through `SHEET` profile.
- PASS: not rejected solely for not being watertight.

**AT-P0-012 — Source preservation**
- Auto-repair is executed.
- PASS: repaired mesh receives a new asset ID; source remains untouched.

**AT-P0-013 — LOD provenance**
- LOD0/1/2 are generated for one prototype mesh.
- PASS: each is a derived asset and deviation metrics are persisted.

### P0 — Issue/claim/review

**AT-P0-020 — Public issue vs academic authority**
- Student opens an issue.
- PASS: issue is created; student cannot cast an academic approval vote unless separately authorized.

**AT-P0-021 — Annotation version binding**
- 3D annotation is created.
- PASS: structure ID, exact asset revision and local-space anchor are recorded.

**AT-P0-022 — No silent remap**
- Annotated mesh is remeshed.
- PASS: annotation is marked as requiring migration/review or stores an explicit migration event; it is not silently moved.

**AT-P0-023 — Specialty eligibility**
- Unqualified reviewer attempts to satisfy an endodontic quorum.
- PASS: review does not count toward quorum.

**AT-P0-024 — Institution diversity**
- Canonical change gets three approvals from one institution only.
- PASS: canonical-change quorum remains unsatisfied under v0.1 policy.

**AT-P0-025 — Reclassify, do not delete**
- Issue reported as “wrong” is accepted as an anatomical variant.
- PASS: issue remains in history and resulting variant/claim references it.

**AT-P0-026 — Dissent**
- Qualified reviewers materially disagree.
- PASS: system can represent `DISPUTED`; it does not force binary approval.

### P0 — AI safety

**AT-P0-030 — No direct publish**
- AI job completes successfully.
- PASS: output status is `AWAITING_HUMAN_REVIEW`; no public release changes occur.

**AT-P0-031 — Patch provenance**
- AI creates a new geometry/content proposal.
- PASS: base versions, new derived assets, AI/job identity, QC and affected entities are recorded.

**AT-P0-032 — Rejected patch**
- Human reviewer rejects AI patch.
- PASS: published state remains unchanged and rejected patch remains auditable.

### P0 — Privacy/quarantine

Tests MUST use synthetic/non-identifiable fixtures, not real patient data.

**AT-P0-040 — Quarantine isolation**
- Synthetic DICOM-like fixture is uploaded to quarantine.
- PASS: it is not reachable from public asset endpoints/storage.

**AT-P0-041 — Burned-in text**
- Fixture contains synthetic burned-in identifying text.
- PASS: automated screening flags it; public release remains blocked until privacy review.

**AT-P0-042 — Header-only is insufficient**
- Metadata is scrubbed but pixel/privacy review is incomplete.
- PASS: data cannot be marked public-ready.

**AT-P0-043 — Raw clinical Git guard**
- A file matching restricted raw-clinical patterns is staged for repository commit in test fixture.
- PASS: repository policy/pre-commit/CI guard rejects it.

### P0 — Release/audit

**AT-P0-050 — Frozen manifest**
- Release is published.
- PASS: its manifest is immutable; a correction requires a new release.

**AT-P0-051 — Withdraw without erasure**
- Published release is withdrawn.
- PASS: record remains accessible to authorized audit/history views with withdrawal reason.

**AT-P0-052 — Reproducibility**
- Given release manifest, system can resolve the exact structure/claim/asset versions used.
- PASS: no `latest` pointer is required to reconstruct the release.

### P1 — Performance/usability goals

P1 failures do not invalidate the domain architecture but block broad public launch.

- Viewer supports isolation/hide/transparency/explode or equivalent inspection.
- FDI 16/36/37 assets lazy-load rather than loading the future full library.
- Mobile and desktop input are usable.
- Before/after comparison is available for reviewed geometry patches.
- Review portal can restore captured camera/layer state from an issue annotation.

Performance budgets MUST be documented against explicit reference hardware/network before public launch; v0.1 does not declare graphics performance to be a clinical accuracy requirement.

## 28. Security and permissions

Minimum conceptual roles:

- `student`
- `contributor`
- `faculty_reviewer`
- `section_editor`
- `rights_reviewer`
- `privacy_reviewer`
- `curator`
- `admin`

Permissions MUST be scoped. `faculty_reviewer` alone SHOULD NOT imply authority over all specialties.

Sensitive clinical/quarantine permissions MUST be separated from ordinary admin/content permissions where practical.

## 29. Architecture decisions intentionally deferred

The following MUST NOT be prematurely frozen without ADR:

- Prisma vs Drizzle vs another DB access layer
- Next.js vs other React framework
- queue technology
- object-storage provider
- CDN provider
- graph database adoption
- exact LOD medical/educational tolerances
- exact mesh compression codec
- AI provider/model
- authentication provider
- production cloud vendor

Astra/Codex MUST NOT pick a deferred technology and then rewrite this document as if it were a project invariant.

## 30. Astra/Codex implementation protocol

AI implementation MUST proceed in small tasks.

Each task MUST include:

- objective
- allowed files/directories
- invariants from this architecture
- explicit non-goals
- migrations/schema changes
- tests
- acceptance criteria
- rollback/revertability
- no unrelated refactors

Recommended sequence:

1. **TASK-001 — Repository scaffold + architecture guards**
2. **TASK-002 — Domain enums/IDs/state machines**
3. **TASK-003 — PostgreSQL core schema + migrations**
4. **TASK-004 — Rights Registry + release gate**
5. **TASK-005 — Issue/claim/evidence model**
6. **TASK-006 — Reviewer eligibility + quorum engine**
7. **TASK-007 — Asset lineage + transforms**
8. **TASK-008 — Mesh QC pipeline skeleton**
9. **TASK-009 — AI Patch Bundle workflow**
10. **TASK-010 — Prototype viewer + issue annotations**
11. **TASK-011 — Review portal**
12. **TASK-012 — Quarantine service skeleton using synthetic fixtures only**
13. **TASK-013 — Prototype FDI 16/36/37 asset ingestion after rights approval**
14. **TASK-014 — End-to-end acceptance suite**
15. **TASK-015 — First frozen prototype release**

Real human-derived data MUST NOT be introduced merely to complete an engineering milestone.

## 31. Definition of Architecture v0.1 success

Architecture v0.1 is successful when:

- canonical anatomy and variants can coexist without destructive rewrites
- rights/provenance are enforceable gates
- academic review authority is separate from ordinary contribution
- AI cannot bypass human publication approval
- human-derived data has an isolated privacy path
- a frozen release can be reconstructed exactly
- the FDI 16/36/37 prototype can execute the full issue → claim → evidence → review → AI patch → QC → release loop
- unresolved scientific disagreement can remain represented rather than erased

This does **not** mean future refactor risk is zero, nor that clinical/academic correctness is “100% proven”. It means the architecture has passed the defined v0.1 engineering and governance gates.

## 32. Change control

Any change to the following requires an ADR:

- core entity semantics
- license acceptance policy
- reviewer quorum policy
- evidence-grade semantics
- AI publish prohibition
- privacy/quarantine boundary
- release immutability
- internal-ID strategy
- SNOMED dependency policy

ADR acceptance itself MUST be reviewable and versioned.

## 33. Immediate next action

Do **not** start with the 3D viewer.

First baseline:

1. this architecture document
2. ADR template
3. Codex TASK-001
4. repository safety rules (`.gitignore`, no-clinical-data policy)

Only after that baseline exists should implementation begin.
