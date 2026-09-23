# Independent review handoff — visual contributions and model candidates

Prepared by implementer; independent review and qualified expert acceptance pending.
Base: `15f072f`. Target: `4587924`.
[Compare](https://github.com/Madmin27/dental-knowledge-base/compare/15f072f...4587924).

## Scope and visible behavior

Owner requested visual contribution preparation and a separate image/radiograph
AI generation design whose outputs go to experts and remain open to criticism.
ADR0008 defines modality boundaries, private quarantine, consent/retention,
processing provenance, scoped human review, enduring challenges and delivery gates.

`/media-guide` is deployed as a read-only EN/TR guide linked from the contribution
dialog and footer. It explicitly says uploads and AI generation are unavailable.
Photo capture guidance describes same-specimen sets and unknown scale; 2D inference
is a research hypothesis and volumes use a separate segmentation route. Existing
source geometry and academic acceptance status are unchanged.

The new pure `media-contract.mjs` plans modality routes and creates pinned candidate
manifests. It is not connected to upload, authorization, AI inference or publication.
It consumes asserted metadata; production must resolve actual grants, rights,
privacy decisions, files and hashes server-side. It cannot inspect whether a
support map is truthful or whether an asset actually passed privacy review.

No image was uploaded, generated, segmented or sent to an external AI service.
No model weights/tools were installed or licensed by this work. No reviewer identity,
quarantine worker, upload endpoint, academic voting, challenge database or public
clinical release is claimed. Tasks MEDIA-002–006 remain implementation work.

## Evidence

- `npm test`: 89 tests passed, including seven media-boundary tests and a bilingual
  guide test. Synthetic metadata only; no clinical input used.
- `python3 -m unittest discover -s tests -v`: 19 passed.
- Clinical-data index guard and staged whitespace checks passed.
- Live HTTPS guide/health returned successfully after dental-preview restart.
- Read-only Chromium checks: EN/TR at 1440 and 390 px, no horizontal overflow and
  no file input implying active upload. Desktop screenshot visually inspected.
  Screenshots under `/tmp` are local artifacts, not independent downloadable proof.
- CI must be checked for the pushed revision separately. No anatomical acceptance.

## Three independent review questions

1. Are the modality distinctions and inferred-region requirements strong enough
   to prevent visually persuasive but unsupported anatomy claims?
2. Does the planned quarantine/permission/retention path keep raw clinical data
   separate from candidate derivation, public derivatives and optional training?
3. Can accepted/superseded candidates remain challengeable without bypassing the
   existing human panel, privacy, conflict-of-interest or publication decisions?

## Limits and next steps

Designing an upload pipeline does not make it safe to accept files today. The next
implementation gate is invited account-based photo intake plus private quarantine
and human privacy review (MEDIA-002/003). The first administrator/reviewer identities
are still pending. Source-specific rights and lawful/ethical permission require
responsible human review; proposed retention periods are not legal certification.

Open-source tool/weight choices must be pinned and reviewed independently before
actual jobs. Model-card limits and scientifically appropriate QC thresholds need
qualified experts. Current contract checks validate metadata consistency, not
anatomical correctness or actual file security. Real generation needs job/resource,
provenance-map and benchmark evidence before any reviewed educational derivative.

Earlier issues remain separate: this change neither closes restore audit #5 nor
settles FDI 16/36/37 morphology. The main specimen and independent interior remain
separate. Owner's expert handover rule still applies: requested AI assistance may
produce candidates but never replaces human anatomical judgment or votes.

Rollback of this milestone removes only the new guide and planning contract/routes;
no clinical storage migration or new data collection needs reversing.
