# Independent advisory review

Adopted 2026-09-23 from [issue #4](https://github.com/Madmin27/dental-knowledge-base/issues/4).
This establishes a review process; it grants no repository or publication rights.

## Roles and independence

The implementation agent prepares changes, executes checks and writes a handoff.
A separate reviewer independently inspects the pinned revision, architecture,
ADRs, task boundaries, source records and available evidence. It may identify
reproducible defects, hypotheses, misleading claims, provenance/licensing gaps,
security and accessibility risks. It may file public, sanitized implementation
findings when authorized by the owner. It does not modify code in the review
role, merge changes or approve its own work.

The reviewer cannot grant anatomical, academic, licensing, privacy or publication
approval. Calling other models is advisory consultation, not automatically an
independent review or qualified human acceptance.

## Milestone handoff

A substantial change includes source/specimen/geometry handling, educational
claims, identity or authorization, contribution storage/privacy, deployment/TLS,
branding/domain, or viewer interaction/loading behavior. Group related small
changes into one milestone; do not create a handoff for every typo.

Use `docs/codex/REVIEW-HANDOFF-YYYY-MM-DD.md`; for multiple milestones on one day
append a descriptive suffix. Copy [the template](codex/REVIEW-HANDOFF-TEMPLATE.md).
Pin base and target commits and link CI. Record the actual deployed revision or
explicitly state that deployment was not verified. Keep prior snapshots intact;
link a superseding handoff rather than silently rewriting the reviewed scope.
Only public/synthetic evidence is shared. Local `/tmp` proofs are not downloadable
GitHub evidence; provide reproduction commands and state that limitation.

Do not describe a handoff as independently reviewed until a separate review
actually exists. A handoff does not automatically notify the external reviewer.

## Finding format

Each finding contains:

- Severity: critical / high / medium / low, with impact-based rationale.
- Affected file/feature and exact revision; source hash/specimen when relevant.
- Reproduction/evidence, including environment and whether checks were executed.
- Expected behavior.
- Actual behavior.
- Impact.
- Minimal remedy.
- Status: verified / hypothesis.
- Human expertise required: field and acceptance criteria, or none for a strictly
  technical defect. An AI anatomical observation remains a hypothesis until
  qualified human assessment establishes it.

Use synthetic data for write tests. Do not access real contribution storage,
credentials, patient-derived material or private tracking links. Sensitive
security reports go privately to the human maintainer; do not publish secrets or
an exploitable vulnerability merely to satisfy a public issue template.

## Resolution

The implementer supplies a candidate fix, commit and reproducible evidence. The
human maintainer determines priority and reviews evidence before closing a
technical finding. Do not use automatic `Fixes #...` closure for review findings.
Scientific/anatomical findings remain open until qualified human review is
recorded against the relevant specimen, source version and acceptance criteria.
A code fix or green test alone is not sufficient. Rights, privacy and publication
questions likewise go to the responsible qualified human, independently of
anatomical review. Unresolved findings carry forward into subsequent handoffs.

## Initial review targets

- Z-Anatomy root morphology and teaching presentation; source fidelity for FDI
  16, 36 and 37, gingival boundaries and root–bone relationships.
- Independent research tooth interior kept separate from the main specimen.
- Contribution intake privacy, authorization, retries and retention boundaries.
- Dental Open Source naming, public domain and stale deployment documentation.
- HTTPS exposure, viewer recovery, and demo/technical/academic-release wording.

This supplements ADR0007. GitHub holds public software-review findings and code
history, not participant submissions, academic deliberation, dissent or ballots.
An issue may flag a potentially misleading anatomical presentation; the qualified
scientific decision belongs in the platform's human-review process. Until that
process exists, record the human review reference without claiming portal
functionality has been implemented or copying private discussion into GitHub.

## Owner clarification — realistic first model, then expert ownership

Recorded 2026-09-23: the immediate objective is a realistic, source-based model
that experts can actually inspect. Lack of a complete expert team does not block
technical preparation or a clearly labelled preview. AI may assist with source
research and implementation during this preparation, but must not invent anatomy
or declare the model anatomically accepted.

Once the owner records the qualified team's assumption of anatomical/editorial
responsibility, AI stops autonomous anatomical proposals, edits and scientific
review. The human team owns anatomical corrections, variation criteria, teaching
claims, dissent and acceptance. AI has no vote or approval authority. Any later
AI assistance on anatomical work requires an explicit request from that team;
its output remains subordinate to their decision. Implementation agents do not
unilaterally declare that this handover has happened.

Separately authorized software maintenance (backups, loading, security, tests)
can continue without deciding anatomy. A technical defect touching source
geometry/presentation must be referred to the human team before an anatomical
change. Independent software auditing does not become an AI scientific board.
