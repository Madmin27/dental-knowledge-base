# ADR 0008 — Visual contributions and reviewable model candidates

Date: 2026-09-23. Status: tested metadata contracts and an implemented invited
private-photo intake/privacy desk. The account-gated portal and processor are
deployed, but **real intake remains disabled pending named-account onboarding**.
AI workers, radiograph/volume intake and academic publication are not deployed.
Current implementation and narrower pilot retention: [private photo pilot](../PRIVATE-PHOTO-PILOT.md).
Owner request: prepare photo/radiograph contributions and design AI reconstruction;
all generated models go to experts and remain open to criticism after acceptance.

This extends Architecture §22 and ADR0007. It does not turn anonymous text intake
into a clinical upload service. The existing source atlas remains unchanged.

## Scientific scope and evidence

| Input | Candidate route | What must remain explicit |
| --- | --- | --- |
| Multiple overlapping photos of one extracted tooth | Camera alignment, multi-view surface reconstruction, optionally AI-assisted masking | Only visible external surfaces; missing surfaces stay missing or are marked inferred. No internal canals/pulp inferred as observed. Scale unknown unless independently calibrated. |
| One or several 2D radiographs | Separate research hypothesis, optionally learned shape priors | Depth/occluded geometry is inferred, not directly measured; a convincing render does not establish the original specimen's exact 3D anatomy. No canonical-atlas replacement or patient-specific truth label. |
| CT/CBCT or other approved volumetric research imaging | Spatially calibrated volume segmentation, surface extraction and measured postprocessing | Segmentation errors, voxel resolution, artefacts and structures not resolved by the acquisition remain visible limitations. No guaranteed fine canal reconstruction. |

Photos/radiographs from different teeth, people or source studies never form a
single specimen merely because FDI numbers match. FDI may be unknown. Demographic
attributes are evidence-backed optional descriptors; never inferred from a mesh
or used as ethnic anatomy presets. Human-derived extracted-tooth photos also
enter privacy review; absence of a visible name is not an automatic exemption.

Primary references informing this design (checked 2026-09-23):

- [COLMAP tutorial](https://colmap.github.io/tutorial.html): multi-view reconstruction
  and camera calibration. Candidate tool, not an installed pipeline. Code and
  dependency terms must be pinned and recorded per job.
- [3D Slicer segmentations](https://slicer.readthedocs.io/en/latest/user_guide/modules/segmentations.html):
  labelmaps and closed-surface representations. Candidate review/segmentation tool.
- [X2Teeth original research](https://arxiv.org/abs/2108.13004): research on learned
  reconstruction from panoramic radiographs. This establishes research relevance,
  not clinical suitability, reproducibility or licensing clearance for our use.
- [DICOM PS3.15 E.3](https://dicom.nema.org/medical/dicom/current/output/chtml/part15/sect_E.3.html):
  de-identification includes pixel data; deleting headers alone is insufficient.
- [OWASP upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html):
  layered validation, bounded files, authorized uploads and storage outside webroot.

No proprietary paid service is selected. Open code does not imply open model
weights or training data. Verify code, dependencies, weights, input rights and
output redistribution separately; record exact versions/hashes and attribution.
Tools with incompatible/unclear terms are withheld, not silently grandfathered.
Do not request new imaging or tooth extraction for this project. Existing permitted
material is sufficient to propose a contribution; acquisition remains a qualified
clinical/research decision outside this platform.

## Contributor experience

English is the contribution language; the interface and guide support EN/TR.
One upload package represents one specimen/study with an opaque project ID.

1. Verified account selects photos, 2D radiographs or a volume. No public upload
   token derived from the existing anonymous tracking link.
2. State contribution purpose, known FDI or unknown, view directions, optional
   calibration/scale and same-specimen evidence. Do not request patient names,
   dates of birth, clinical record numbers, exact visit dates or home addresses.
3. Private rights/authority reference and purpose-specific permissions are reviewed.
   Processing, AI inference, derivative publication, raw-image publication and
   training reuse are separate permissions. Training is off by default. Withholding
   training permission never excludes a valid educational contribution.
4. Show files, package limits and intended audience before submission. Save draft,
   resume failed transfers and use idempotency per chunk/finalization. Server quotas
   remain authoritative; metadata never authorizes file processing.
5. Receipt shows `quarantined`, `needs_information`, `privacy_review`,
   `eligible_for_processing`, `candidate_ready`, `expert_review`, `changes_requested`,
   `rejected`, `accepted_for_scope`, `published`, `disputed`, `withdrawn` separately.
   Each status explains the next action; rejected contributions have an appeal path.
6. Preview which sanitized derivatives would be public before any publication.
   Upload consent is not public-release consent; default is private.

Draft engineering limits for an invited PHOTO pilot: JPEG/PNG only, 20 MiB per
file, 120 files and 512 MiB per package, 40 megapixels per decoded image. These
are resource controls, not a claim that this many photographs ensures valid 3D.
Reject SVG/PDF/HTML/ZIP/video/unsupported formats initially. 2D JPEG/PNG exports
remain radiographic data. DICOM/volumes need a separately tested importer with
series/voxel/decoded-size limits; do not widen the photo endpoint to accept ZIPs.
No real uploads until identity, quota, quarantine, erasure and recovery gates pass.

## Trust boundaries and storage

- Web app reserves quota and opaque object IDs after account authorization. Store
  ownership, package revision and intended modality transactionally in PostgreSQL.
- Raw bytes stream into an isolated private spool/object bucket outside Git and
  webroot, mode 0700, service-restricted access, encryption at rest. Neither original
  filenames nor patient content appear in URLs, logs, tracing or metrics.
- Enforce per-file/package/account/daily/global byte quotas and disk free-space
  reserve before/during streaming. Bounded resumable chunks, expiry, cancellation,
  cleanup and atomic finalization must survive process crashes. Authorize every
  upload, resume, download, delete and review request; prevent cross-account IDs.
- Treat file names, declared types, EXIF/DICOM fields and embedded text as untrusted.
  Check signature plus full decode in a no-network, unprivileged worker with CPU,
  RAM, wall-clock and decoded-pixel/voxel limits. Malware checks complement decoding;
  timeout/scanner failure leaves quarantine closed. No shell interpolation.
- Photo processing re-encodes a derivative, strips nonessential metadata and checks
  pixel content. Preserve required calibration through a reviewed structured record,
  not indiscriminate EXIF copying. Keep source/derivative transformations private.
- DICOM importer validates series consistency, orientation, spacing, units and
  pixel content. Facial/recognizable structures and burned-in text require explicit
  handling. Review must preserve relevant educational anatomy where possible.
- OCR/detectors assist a **human privacy reviewer**; no clean flag based solely on
  software, image metadata or the uploader's assertion. Derivatives can remain
  sensitive and need a separate public-release decision.
- Restricted raw fingerprint uses keyed HMAC; raw hashes/UIDs never go into public
  manifests. Public provenance points to approved derivative IDs/hashes.
- Isolated AI workers receive only approved derivatives, no external network or
  credentials. Clinical inputs and prompts are never automatically sent to external
  AI vendors or our advisory-model gateway. Any future external processing requires
  a separately reviewed explicit permission and operator decision.
- Proposed retention defaults for owner/privacy-officer approval: incomplete uploads
  24 hours; rejected raw packages 30 days; approved raw material 90 days after final
  decision, unless a documented purpose requires otherwise. These are product-policy
  proposals, not legal clearance. Approved derivative retention is separate.
- Erasure revokes downloads and cancels jobs, follows the dependency graph through
  crops, masks, meshes, thumbnails and caches, and applies backup retention. Store
  tombstones without copying erased prose. Restore reconciles tombstones first;
  unresolved branch/redaction conflicts stop under audit #5's correction.

## Data/API contract to implement

| Entity | Required references |
| --- | --- |
| MediaPackage / revision | owner account, specimen, modality, purpose, FDI/unknown, consent-policy revision, retention deadline |
| MediaObject | package revision, private storage ID, bytes, decoded dimensions, restricted HMAC, processing state |
| ReviewedDerivative | source object IDs, transform/config digest, derivative hash, human privacy decision and scope |
| ProcessingAuthorization | named human requester, scoped grant, input revision, purpose, consent/rights/privacy decisions and expiry |
| ReconstructionJob | immutable input manifest, tool/container/code/weights hashes, configuration, seed, resources, logs policy, idempotency ID |
| ModelCandidate / revision | job, specimen, source derivatives, mesh hash, support-map hash, units/frame, limitations, parent revision |
| ReviewRound / Decision | frozen candidate/evidence/policy/roster snapshots, criterion assessments, votes/abstentions/COI, rationale, minority reports |
| Challenge / revision | exact candidate version, region/structure, evidence and rationale, moderation decisions and appeal |
| Publication / withdrawal | exact approved derivative/review snapshot, independent rights/privacy/release decisions, warning and supersession links |

Proposed authenticated endpoints: reserve package, upload bounded chunk, finalize,
view own status, cancel/request deletion; separate reviewer endpoints for privacy,
processing authorization, candidate assessment and challenge handling. All mutations
use optimistic revision checks and idempotency; transitions/audit/outbox share a DB
transaction. No actual endpoint is added by this ADR. Never implement grants as
client-submitted `approved: true` flags.

`packages/mesh-pipeline/media-contract.mjs` is a pure planning/manifest contract.
It rejects mixed specimens, raw-source labels and unsupported photo-internal claims,
records pinned AI provenance, and always creates a private unaccepted candidate.
It does not verify pixels, actual licenses, identity, grants or decision signatures;
production must resolve trusted records server-side before invoking it. Its digest
is content binding, not a digital signature or anatomical guarantee.

## Reconstruction and quality workflow

1. A human issues a scoped processing request after privacy/rights/inference consent.
   The latest owner instruction allows AI candidate generation when requested;
   it does not reinstate autonomous AI scientific governance after expert handover.
2. Freeze the input manifest. Unknown scale stays unknown; inferred calibration is
   labelled. Persist coordinate frame, units and specimen alignment decisions.
3. Run classical/AI-assisted reconstruction or segmentation in a resource-bounded
   job. Record method/weights/config/code/container hashes and seed, not only a
   prompt. Pin tool versions and model-card limitations; don't train on contributions
   merely because inference was permitted. No AI calls run as part of this design.
4. Preserve raw reconstruction and segmentation. Smoothing, decimation, hole filling
   and remeshing each produce a new derivative and deviation report. No silent
   cosmetic root/canal completion. Render realism does not determine anatomical QC.
5. Technical QC checks coordinate/scale consistency, coverage, invalid/nonmanifold
   geometry, disconnected components, self-intersections, and deviation to evidence.
   Metric selection/thresholds depend on modality and the proposed teaching use;
   expert team defines them. No universal millimetre threshold is invented here.
6. Region/face support map distinguishes `image_supported`, `inferred`, `unknown`.
   It points to source views/slices and transformations. Confidence scores are not
   accuracy percentages unless calibrated and validated for the relevant task.
7. A private candidate is submitted to experts with side-by-side source views,
   volume slices when available, overlays, measurements, missing-data map and
   processing history. For 2D-only proposals, require explicit inferred-depth warning
   and independently supported evidence before promoting any factual anatomy claim.

## Expert review, acceptance and permanent criticism

Use ADR0007's verified human roles and frozen panels; don't implement a second
ad-hoc voting system. Independent reviewers assess source fidelity, FDI/orientation,
root number/shape, canal visibility where supported, scale, segmentation, inferred
regions and teaching scope. Accepted decisions record exact criteria, evidence,
reviewers, numerator/eligible denominator, abstentions/COI, rationale and dissent.
The existing 80% policy cannot override privacy, licensing, evidence insufficiency
or publication gates. AI does not vote. Contributor and generator cannot approve
their own candidate.

Acceptance is `accepted for stated educational scope and version`, not absolute
truth. Every retained version stays addressable with a challenge entry point,
even if superseded or its original intake ticket was archived. Challenges are
separate records from the capped/archived anonymous intake history. New evidence
can open `disputed` review; accepted bytes and previous decisions remain historical.
A critical claim may be temporarily withheld by an authorized human with a visible
reason. Neither an anonymous complaint nor an AI output automatically rewrites or
withdraws a published asset. Rejection/abuse moderation records reasons and allows
appeal; criticism is not deleted merely because a model was previously approved.
Privacy removal can hide sensitive content while retaining a nonidentifying status
stub and audit reason. New generation means a new version and new review round;
previous votes are never carried forward silently.

## Delivery sequence and release gates

| Task | Deliverable | Required evidence |
| --- | --- | --- |
| MEDIA-001 (this milestone) | EN/TR capture guide, this design, pure manifest contracts | Source references, synthetic boundary tests, explicit unavailable-feature labels |
| MEDIA-002 | Verified accounts, scoped invited photo intake and private quarantine | Ownership/IDOR, CSRF, malformed files, decoder bombs, quota races, scanner outage, interrupted upload, erased-data restore tests |
| MEDIA-003 | Human privacy desk and reviewed derivatives | Pixel/metadata checks, separate consent scopes, expiry/revocation, audited downloads and deletion rehearsal |
| MEDIA-004 | One local reconstruction worker on synthetic or cleared material | Reproducible job provenance, resource limits, scale/support maps, technical QC and independent expert comparison |
| MEDIA-005 | Expert candidate review and enduring challenge records | Frozen-panel/80% policy, no self-review/AI vote, stale-input rejection, dissent, versioning, reopening and withdrawal checks |
| MEDIA-006 | Invited radiograph/volume importer pilot | Modality-specific metadata/privacy tests, series consistency, calibration and unresolved-geometry review |

Release raw-image upload only after MEDIA-002/003 gates; AI model production requires
004 and review delivery requires 005. No broad clinical launch just to demonstrate
an upload button. Prioritize a usable source-based atlas while these tracks mature.

## 2026-09-23 independent-review refinement — evidence classes (contract v2)

This revision addresses the owner's forwarded advisory review. It is an implementer
response, not independent acceptance. The following distinctions are normative for
candidate creation and future UI/API/review integration, not merely method labels.

| `candidateClass` | Meaning | Review boundary |
| --- | --- | --- |
| `OBSERVATION_DERIVED` | Evidence-derived working candidate with unresolved calibration, e.g. an uncalibrated volume segmentation | Non-metric research preview; not a calibrated measurement or canonical specimen |
| `RECONSTRUCTED_FROM_CALIBRATED_IMAGING` | Segmentation derived from a volume with a referenced verified calibration record | Review the spatial metadata and resolution; does not mean unmodified ground truth |
| `MULTIVIEW_SURFACE_RECONSTRUCTION` | Reconstruction of externally supported surface geometry | Inspect camera registration, coverage and scale separately; no observed internal anatomy |
| `AI_INFERRED_HYPOTHESIS` | Learned/generative shape inference, including 2D-only inference | Illustrative/research hypothesis or model-prior visualization only |
| `HYBRID` | A pipeline combining supported reconstruction and inferred completion | Per-region decomposition is mandatory; whole model inherits the restrictive inferred ceiling |

AI-assisted segmentation does not automatically make a measured-volume derivation
a generative prior; classify evidence and geometric operations, not just the tool's
AI branding. Conversely, generative filling cannot keep a pure multiview/calibrated
class merely because the input contained photographs or a volume. The constructor
promotes a previously pure class to HYBRID when support maps contain inferred and
supported regions, or AI_INFERRED_HYPOTHESIS if inference has no supported region.
A client-declared class cannot override the evidence-derived class.

### Non-negotiable 2D-only publication ceiling

A candidate whose evidence basis is only 2D radiography cannot be published as
`specimen_specific_3d_anatomy` or `canonical`. The only permitted publication intents
are `illustrative_research_hypothesis` and `model_prior_visualization`, still subject
to all rights/privacy/expert/release decisions. Attractive rendering, high model
confidence, an asserted scale or a majority vote cannot lift this ceiling.

All new candidates start private/unaccepted and `canonicalEligible=false`. The pure
contract checks a requested publication scope when supplied and emits the ceiling;
it is not a deployed publication endpoint. Future release code must independently
recompute/verify the ceiling against the frozen evidence and candidate revisions.

New independent 3D evidence requires a **new evidence set and candidate version**,
with new registration, support map, class, review and release decisions. It cannot
retroactively relabel the original 2D hypothesis. A validated supported component
of a HYBRID may become a separate derivative with its own restricted scope/review;
approval of that component does not validate inferred regions of the parent.

### Support-map technical contract

The manifest requires the complete map and its digest; a bare hash is insufficient.
The map binds `schemaVersion`, `meshSha256`, `coordinateFrameId`, `faceCount` and a
bounded ordered region list. Regions partition all mesh faces without gaps or
overlaps. Decimation/remeshing changes face IDs and requires a new bound map.

Each region contains:

- `id`, `firstFace`, `faceCount`: stable identity within this exact mesh revision.
- `supportType`: `image_supported`, `inferred` or `unknown`.
- `sourceReferences`: reviewed derivative `assetId`, exact `sha256` and `viewId`
  resolving to a particular photograph or slice/volume view in the evidence set.
  Volume views resolve slice/voxel ROI and spacing through an immutable referenced
  view record; a free-text label alone is not sufficient in the processing service.
- `registration`: direction is source frame → candidate frame. Store source/target
  frame IDs, units and transform type. `affine_3d` uses a finite row-major 4×4 matrix;
  `projection_2d` references exact camera calibration and pose hashes. A 2D pixel
  is not treated as a depth-bearing 3D point by inventing a 4×4 transform.
- `supportConfidence`: null when unavailable, otherwise [0,1] plus
  `confidenceMethodId`. Score meaning/calibration population and known limitations
  belong in the method record. It is not automatically an accuracy probability.
- `reviewStatus`, `reviewedBy`: newly generated maps always start `pending`/null.
  Later reviews are append-only records bound to map/region hash, verified reviewer,
  eligibility/COI snapshot, time, decision and rationale. Generator-supplied reviewer
  identities or approval flags cannot authorize these transitions.

Supported regions require references to known matching source hashes; unknown
regions assert neither source support nor a confidence score. Inferred-region
references express conditioning evidence, not a claim that depth was observed.
The current metadata validator does not compute transforms, inspect pixels,
verify calibration records or check reviewer authority. Those remain processing
and review service duties, including invertibility, physical plausibility and
registration residual checks. Never confuse schema validity with registration QC.

UI requirements: display class and evidence basis beside the candidate title, keep
inferred/unknown overlays accessible in both languages, show linked source view on
region selection, confidence meaning and reviewer state; show the publication
ceiling on every detail/export/review screen. No 3D candidate viewer is deployed
by this refinement; the public preparation guide explains the distinctions now.

### Privacy categories and metric families

Privacy uses **combinable risk tags**, not a lowest-risk mutually exclusive choice:
`specimen_only_unlinked`, `linked_research_specimen`, `clinical_context`, `radiograph`,
`volume`, `face_maxillofacial_identifiable`, `unknown`. The first tag is an assertion
of an unlinked specimen-only image, not verified anonymity. A privacy reviewer
confirms or changes it; unknown remains restrictive. Radiograph/volume tags cannot
be removed by selecting specimen-only. Any identifying/maxillofacial tag requires
its additional handling. Every human-derived category still requires human privacy
review; all candidate manifests start `privacyRelease=null`.

Metric families are `surface_deviation`, `landmark_error`, `volumetric_overlap`,
`topology_integrity`, `scale_consistency`, `registration_residual`,
`region_support_coverage`. Each future metric record binds the candidate/evidence
revision, region, units, algorithm/version, reference, aggregation, uncertainty and
expert threshold-policy revision. Unavailable metrics are explicitly `not_applicable`
or `not_measured`, never zero/passed. Volumetric overlap requires an appropriate
reference segmentation; unknown scale forbids physical-unit error claims. Thresholds
remain expert-defined by modality/region/educational purpose; no universal mm or
percentage acceptance rule is introduced. Metrics do not replace expert judgment.

Candidate manifest schema advances from v1 to v2. No production candidate store
exists, so no data migration is claimed; any future import of v1 must request the
missing evidence map/classification rather than silently default it to approved.
