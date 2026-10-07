# Contribution operating policy — pilot v1, 7 October 2026

This is an operational editorial process, not accreditation, an ethics board or
clinical validation. The owner requested a disciplined, semi-formal structure.
Existing ADR0007 remains the design for scientific governance. This milestone
implements its private triage and a narrow technical-publication boundary.

## Records and visibility

| Record | Readers | Decision authority |
| --- | --- | --- |
| Original text contribution and follow-ups | Tracking-link holders; appointed intake editors; managers | Editor triage only |
| Membership application | Applicant and membership managers | Verified, reasoned limited appointment |
| Clinical photo package | Owner and separately authorised privacy reviewers, according to existing photo policy | Privacy review; not scientific acceptance |
| Proposed public technical summary | Same private intake readers until export | Contributor consent and a distinct current editor |
| GitHub issue | Everyone if posted to the public repository | Technical implementation tracking only |
| Scientific panel, ballots, dissent, appeals | Planned scoped expert workspace | Qualified humans; not implemented by this desk |

No public contribution list exists. General membership, self-declared credentials,
a GitHub account, popularity or an anatomy-reviewer grant does not open the private
intake queue. Tracking URLs are bearer credentials: whoever holds one can respond
and consent. They are not verified expert identities. Do not forward them to GitHub.
The server strips editor account IDs from contributor-facing responses; editors
see stable internal IDs for accountability. Public real-name display is not implied.

The editorial desk is `/review/contributions`, English first with Turkish controls.
Its discussion stream is **contributor-visible**. There is no confidential internal
note channel in this milestone. Model snapshots stay source/version-bound; the
desk does not infer missing anatomy or alter a specimen.

## Roles and appointment

- **Contributor:** submits observations/evidence and follows a private receipt;
  can challenge a response, request erasure and permit/withdraw publication.
- **Intake editor:** an enabled individual with a time-limited `intake_editors`
  appointment; can triage, take responsibility, respond and prepare technical tasks.
  Cannot manage memberships, inspect protected photos or cast scientific ballots.
- **Manager:** appoints/coordinates the pilot and can also perform intake work.
  Does not become an anatomical or privacy expert by holding this role.
- **Second publication editor:** another enabled, currently appointed individual;
  reviews the exact proposed technical summary. Cannot approve their own draft.
- **Scientific expert / domain editor / appeal panel:** ADR0007 roles. They need
  recorded qualification, scope and conflicts; this desk does not implement them.

Use the existing local operator procedure with `action: appoint-intake-editor` or
`remove-intake-editor`, an existing accountId, contactVerified, expiry (maximum90
 days), grantor and verification reference. Identity evidence is checked privately,
not invented by the tool. Removal invalidates sessions. Keep at least two actual
people before using the publication path; never manufacture a second account or
AI identity to pass that gate. Applications can lead to this appointment after
human verification; appointment is currently operator-driven, not a new applicant
self-service privilege button.

## Work discipline

1. **Receive:** preserve original observation, category and model/view references.
   Storage consent is not publication consent. Existing records keep their private
   status; there is no bulk migration into GitHub.
2. **Triage:** editor takes responsibility and records a follow-up date within30
   days and priority. The queue shows unassigned/assigned/overdue work. Taking over
   responsibility adds history; it does not overwrite a previous editor's account.
3. **Assess:** identify expected/observed behavior, sources, affected version,
   reproducibility and impact. Ask for evidence without treating missing evidence
   as dishonesty. Scientific claims wait for qualified human review.
4. **Plan or close with a reason:** use received → triage → needs_evidence /
   change_planned → addressed / closed and the existing permitted reopen paths.
   Addressed requires an implementation/verification link. Closed is an intake
   outcome, not scientific acceptance or deletion.
5. **Challenge:** contributor adds evidence or asks for reconsideration; editor can
   reopen. If the challenge concerns the editor's own conduct, refer to another
   appointed human. There is no implemented independent appeals-board workflow yet.
6. **Retain/erase:** retain audit metadata; honour the existing private text
   redaction and backup-reconciliation policy. Publication text is erased with the
   private record. Do not assume a public GitHub copy disappears with local erasure.

Suggested pilot targets, **not measured guarantees**: daily queue check, first
response within three working days, next-step update within ten working days;
review overdue items weekly. If staffing cannot meet these targets, record the
reason and update the follow-up date. Deadlines never generate automatic approval.
New contributions are visible in the shared private queue without copying files
or forwarding emails. Automatic email alerts for this text queue are not wired;
the earlier membership-application notification worker is a different queue and
still depends on functioning SMTP. Do not promise an alert on every text submission.

## GitHub publication: a separate decision

The owner's October request allows an approved technical work summary to become
an issue. This narrows the earlier “GitHub only code” rule: private contributions,
clinical files and scientific deliberations still stay on the platform.

Only `technical` submissions can use this bridge. Editors write a **new English
summary**, never auto-copy private submission text. Include reproduction steps,
expected/observed result, impact, version and public evidence where appropriate.
Do not include names/contact details, tracking links, credentials, patient material
or undisclosed security vulnerabilities. Language and absence of personal data
require human checking; the software does not claim to detect them reliably.

The exact repository, title, body and source revision are hashed. The contributor
sees the text and explicitly permits it; another current editor checks privacy,
rights and technical scope. Any normal follow-up, responsibility change or state
change invalidates the draft, requiring a new draft and approvals. New drafts never
inherit consent. Withdrawal is available even after archive/history cap and blocks
future exports; an already-withdrawn retry is a no-op. Either editor's expiry or
account disable blocks download. Root/host operators remain trusted infrastructure
administrators; this is not a control against a compromised server or shared account.

Export downloads **exactly the approved title/body**. No GitHub credential or API
publisher was added. A human creates the issue in `Madmin27/dental-knowledge-base`
and records its URL here. The issue is attributed by GitHub to the human who posts
it; contributor names are not automatically exposed. The recorded URL is a manual
reference, not proof of publication content or automatic status synchronization.
A changed Markdown file is outside the approved summary; the publisher must check
it before posting. Do not grant blanket approval to future unreviewed issue bodies.

If a public copy needs correction/removal, the editor tracks the request and the
GitHub action separately. Local withdrawal is not a guarantee that public forks,
notifications, caches or downloaded files can be recalled. Sensitive vulnerabilities
use a private security reporting route, not public technical issue export.

## Scientific decisions and the 80 percent rule

No ballot or “accepted anatomy” button was added. The next expert-workspace stage
must implement ADR0007's frozen candidate/evidence/rubric/version, qualified roster,
COI exclusions, justified ballots, dissent and independent appeals. The proposed
80% denominator includes the whole eligible roster, with abstentions and missing
responses shown; an unresolved material objection prevents acceptance even with
100% support. Quorum and institutional diversity are defined before a round, not
adjusted to manufacture a result. These are planned rules until implemented and
adopted by the human panel, not current platform capabilities or measured accuracy.

## Next implementation gates

1. Complete real SMTP and owner onboarding; appoint two independently verified
   intake editors. Rehearse one synthetic contribution with actual human users.
2. Add individual expert assignments and private scoped discussion in PostgreSQL,
   importing source IDs/revisions idempotently with privacy-erasure reconciliation.
3. Implement frozen review rounds, structured criteria, COI, justified ballots,
   dissent and appeals against the first real expert-pilot findings.
4. Only then consider automated GitHub publishing: narrowly scoped GitHub App,
   immutable approved payload, idempotency/reconciliation, delivery audit and
   contributor-visible external status. No secrets or private discussions in webhooks.

## Inspirations and limits

- [JOSS editorial guide](https://joss.readthedocs.io/en/latest/editing.html): named
  editorial coordination and reviewer checklists. We use the discipline, not its
  fully public review model for private/clinical contributions.
- [JOSS review checklist](https://github.com/openjournals/joss/blob/main/docs/review_checklist.md):
  explicit criteria and conflict-of-interest declaration.
- [GitHub private vulnerability reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/report-privately):
  security-sensitive details should not become a public issue by default.

These references inspire local policy; none certifies this project or its anatomy.

## Platform feedback (7 October 2026)

Small labelled pencil controls open a separate feedback dialog on public pages,
the member workspace, administration and editorial desk. Bug/usability/idea reports
are distinct from anatomical/content contributions and accept English or Turkish.
Only an allowlisted page area, generic section and topic are recorded with the
submitted text; no DOM contents, URL queries/fragments, account identity, model
snapshot or screenshot are collected automatically. Users are asked not to include
private or clinical information. Anyone may submit without gaining review rights.

Persistence, rate limits, backups, private bearer tracking, editorial replies and
follow-up reuse the existing intake service. Records carry category `feedback`
and strict `platform-feedback` context. The editor desk presents a separate queue
filter. These reports are not scientific acceptance or a live AI chat and are not
automatically sent to external AI, email or GitHub. They currently cannot use the
technical-publication export gate. A human developer/editor decides which items to
implement; anatomical proposals still require qualified human review.

Tracking is link-based and is not yet associated with the signed-in member account.
The user must save the private link; losing it means losing self-service access.
Drafts and pending retry identifiers live only in the current tab. Retry reuses the
same submission ID; a timeout is not displayed as successful delivery. No automated
AI task runner or continuous review schedule was added.
