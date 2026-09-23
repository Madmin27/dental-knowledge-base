# DentalKnowledgeBase — product quality roadmap

Date: 2026-09-22. This is a delivery plan, not a claim of academic acceptance.
Public branding/domain is still undecided; the implementation keeps the project name.

## Delivered in the studio interface revision

- One local design system across the anatomy viewer, independent interior viewer,
  project page, source dialogs and private contribution tracking.
- Light/dark preference, clear typography, dedicated model viewport, touch-friendly
  controls, mobile navigation, keyboard rotation, fullscreen and usage help.
- FDI/name search including Turkish diacritics, explicit absent-third-molar results,
  and selection across upper/lower filters.
- Existing source tissue geometry, transparency behavior and source-pose constraints
  preserved. Distinct research sources remain distinct.
- Current collection descriptions and a three-step contribution guide replace the
  obsolete “no 3D models yet” claim and static test-count marketing.
- Loading failure/context-loss messages have a reload action. Interface preferences
  are stored locally; no external fonts, trackers, paid assets or services were added.

## Delivery sequence and acceptance gates

The immediate next step is a bounded **3–5-person expert pilot**, using
[EXPERT-PILOT.md](EXPERT-PILOT.md) and the existing viewer. Do not wait for
TASK-005/006 completion to collect observations. Use real findings to refine
claim/evidence and reviewer requirements. Pilot findings are advisory records,
not publication decisions; the authority and public-operation gates below still
apply. This expert pilot precedes the broader student pilot listed under P2.

| Priority | Track | Next deliverable | Acceptance evidence |
| --- | --- | --- | --- |
| P0 | Anatomical reliability | Execute `EXPERT-REVIEW-PACK.md` with named, qualified reviewers; inspect FDI 16/36/37, source alignment, gingival boundaries, nerve/artery labels and independent interior specimen | Findings identify source hash, structure, camera, criterion, evidence, severity and reviewer. Blocking inaccuracies resolved or explicitly withheld from teaching publication. |
| P0 | Academic decisions | TASK-005/006/011: persisted specimen/variant/claim/evidence; verified reviewer eligibility; frozen panel; reasoned decision records | Permission tests, stale-version rejection, quorum/80% rules, conflicts of interest, dissent and appeal behavior. AI suggestions cannot approve. ADR0006 remains authoritative. |
| P0 | Safe public operation | CONTRIB-002: HTTPS, intake abuse controls, durable off-host backup and restoration, privacy/moderation procedure | Public origin verified, quota tests, actual restore rehearsal and restricted access checks. Local LAN availability is not a public release. |
| P1 | International learning | Turkish/English UI dictionary; reviewed Latin terminology; model-specific learning objectives | Every visible static/dynamic/error string covered; preference and shared-view consistency; terminology reviewed by dental educator. No unreviewed machine-translated anatomy claims. |
| P1 | Collection expansion | Select independent, openly licensed internal tooth models and document demographic/developmental metadata | Source files, license, derivative history, scale, completeness, developmental stage and reviewer approval; no age/sex/population inferred from mesh appearance. Unknown stays unknown. |
| P1 | Contribution coordination | CONTRIB-001: user-approved publishable summary, GitHub issue draft/import and canonical link tracking | No private text/token leakage; idempotent synchronization; author's consent and attribution; GitHub activity never substitutes for academic approval. |
| P1 | Real device performance | Profile a student laptop and a physical phone; implement measured LOD/loading improvements if needed | Time to usable model and interaction FPS recorded with device/network specification. Target 30 FPS and usable first view in 10 seconds at 10 Mbps; targets have not been established by headless tests. |
| P1 | Accessibility | Keyboard, focus order, screen reader, contrast, zoom/reflow and touch review of each workflow | Follow WCAG 2.2; manual assistive-technology checks as well as automation. A few passing browser tests are not a conformance certification. |
| P2 | Educational usefulness | Pilot with students/educators, source-backed exercises and annotated views | Observe actual tasks: find FDI 36, inspect roots in bone, explain cavity-view limits, submit a reproducible finding. Record task success and misunderstandings before expanding. |
| P2 | Open project stewardship | Contributor guide, maintenance ownership, reviewer onboarding and versioned release notes | Human-reviewed onboarding, transparent scopes of authority, named consenting reviewers, documented support and update process. |

## Scope and review discipline

The preview currently demonstrates anatomy exploration, not clinical measurement
or treatment planning. The adult dentition source and the separate remodeled
research tooth must not be represented as the same individual. Ancestry, geography,
sex and age are evidence-backed specimen descriptors, not deterministic anatomy
presets. Do not synthesize missing root canals or vascular connections to improve
visual appearance.

A release checklist must distinguish: code verified, browser visually inspected,
physical device tested, academic reviewer accepted, user accepted and public
service deployed. These are independent states.

## References

- Architecture: `architecture/DENTAL_KNOWLEDGE_BASE_ARCHITECTURE_v0.1.md`
- Anatomical quality: `ATLAS-QUALITY-PLAN.md`
- Review scenarios: `EXPERT-REVIEW-PACK.md`
- Contributions: `CONTRIBUTING-ATLAS.md`
- Decision model: `adr/0006-variant-context-and-reasoned-review.md`
- Accessibility criteria: https://www.w3.org/TR/WCAG22/
