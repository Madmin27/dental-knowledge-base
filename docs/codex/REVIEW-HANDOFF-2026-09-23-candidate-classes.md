# Independent review handoff — candidate evidence classes and support maps

Prepared by implementer; independent acceptance pending. This responds to the
owner-forwarded ADR0008 review, not a new AI review performed by this agent.
Base: `76bff03`; target code: `968a416`.
[Compare](https://github.com/Madmin27/dental-knowledge-base/compare/76bff03...968a416).
No independent finding is closed by this handoff.

## Changes

- Candidate manifest v2 separates OBSERVATION_DERIVED, calibrated-imaging,
  multiview-surface, AI-inferred hypothesis and HYBRID classes. Class derives from
  modality/method/calibration-reference metadata and region support; caller class
  assertions must agree. Inferred completion cannot retain a pure surface class.
- 2D-only candidates have only illustrative research/model-prior publication
  intents; specimen-specific 3D anatomy and canonical requests reject. Scale and
  caller-supplied approval/ceiling fields do not remove this restriction.
- All new manifests remain private/unaccepted/non-canonical. New independent
  evidence requires a new candidate/review, not retroactive promotion of an old
  inferred version. Publication service enforcement remains future implementation.
- Complete support maps bind mesh hash/frame and partition every face. Per-region
  source hash/view, registration, support type, nullable confidence/method and
  pending/null review fields are checked. Photo/2D radiograph references cannot
  claim depth-bearing affine registration; projection calibration/pose are pinned.
- Combinable privacy tags and seven metric-family identifiers are defined. Privacy
  tags never grant release; metric thresholds remain expert decisions.
- EN/TR public guide explains classes and the 2D publication ceiling. No upload,
  reconstruction worker, scientific approval or generated geometry was added.

## Evidence

`npm test`: **95 tests passed**, including 13 media-contract cases. New adversarial
cases exercise 2D class/scope spoofing, inferred completion, incomplete coverage,
wrong source hashes/frames, fake support-review approval, unqualified confidence,
privacy-tag non-release and 2D affine misuse. Clinical-data index guard and
whitespace checks passed. Live HTTPS health and guide text were verified in both
languages after restarting only dental-preview. No image or private data used.
CI must be checked on the pushed commit separately; no new real-device timing or
visual screenshot comparison was performed in this refinement.

## Three review questions

1. Can a valid candidate manifest still misclassify inferred regions or bypass the
   2D-only ceiling using a method/class/scale declaration?
2. Does the support-map contract adequately bind every face to the exact model,
   source view and registration, without implying that structural checks establish
   correctness of geometry or of the stated evidence?
3. Are privacy risk tags and metric families operationally clear without becoming
   self-issued privacy release or numerical anatomical acceptance?

## Remaining boundaries

These are **pure metadata contracts**, not an API identity/authorization service.
Input source modality, actual files, calibration records and license-review IDs
must be resolved from trusted server records. The validator cannot prove that a
photograph is really a volume, a referenced calibration is authentic, a transform
is physically sound, or a confidence method is scientifically calibrated. The
processing service must verify transform invertibility and residuals, project
source views, and QC actual support coverage. Expert judgment remains separate.

Later human review changes use separate audited records bound to candidate/map
revision and verified reviewer scope; the constructor intentionally accepts no
pre-approved map. No persistence exists for candidate v1, so no data migration was
run. Future v1 imports must supply missing evidence/class fields, not infer approval.
The public site currently contains the preparation guide, not a candidate detail,
export or voting UI. Required class/ceiling badges for those future screens are
specified in ADR0008. No anatomical, privacy or publication approval is claimed.
