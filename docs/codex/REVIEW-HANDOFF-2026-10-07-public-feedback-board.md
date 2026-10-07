# Independent review handoff — 7 October 2026 / public feedback board

Prepared by implementer; independent review pending.

## Pinned scope

- Base: `b03fc4e`.
- Code: `e7485c4b85175f01fb17d49f1027a1e284ed8ae2`.
- Deployment: https://dentalopensource.org/feedback, existing preview service.
- Scope: public product-feedback summaries and private publication controls;
  no anatomical source, expert decision or identity-policy changes.

## Behavior and publication boundary

The lower-right frontend link opens a bilingual board with reviewing, planned,
resolved and deferred filters. The board contains approved summaries and responses,
not original private reports. No production examples or fabricated resolutions
were inserted. Its empty state is intentional until real publication approval.

A named editor prepares an anonymous title, body/response and public status.
The submitter uses their private tracking capability to approve that exact draft.
A current named editor then approves publication. For platform summaries, the draft
editor can approve; the two-editor GitHub export rule for technical reports is
unchanged and feedback cannot be exported/linked through that gate. Neither route
confers scientific authority. The contributor may refuse publication without
losing their private feedback record.

The status is included in the digest. Resolved requires an addressed internal
record (the existing addressed transition requires an implementation evidence link).
A new draft needs new consent; ordinary private events invalidate and hide the
prior card. Contributor withdrawal, editor withdrawal, redaction and archival
remove the card from subsequent public reads. Previously downloaded copies or
already open browser views cannot be recalled.

Public data is explicitly limited to digest ID, title, body and status. No private
record ID, account ID, alias, history, source evidence or tracking token is projected.
Free-text de-identification remains an editor responsibility. There is no automatic
external AI transfer, code execution, public commenting or GitHub publishing.

## Evidence

- 109 npm tests passed in a network-disabled, read-only-source, resource-limited
  container. New cases cover consent/approval separation, same-editor platform
  approval, unchanged technical restrictions, safe field projection, persisted
  publication after restart, sender withdrawal and editor removal.
- Initial test failures were fixture defects: an actor string was supplied where
  a header object was required; a UI queue fixture hardcoded the technical category.
  Both fixtures were corrected and rerun successfully.
- Synthetic Chromium mobile board: status filtering, textContent escaping of an
  HTML-shaped title, feedback dialog and editor publish action passed. Screenshot
  inspected. No real account or private record was used in browser fixtures.
- [Code CI](https://github.com/Madmin27/dental-knowledge-base/actions/runs/37659694961).
- Encrypted intake backup preceded restart. Live health, both board languages,
  board JS/CSS and public API returned200 with no-store. The public API contained
  zero cards; no private records were read during live verification.

## Operations and limits

A public-only in-memory index is rebuilt from active durable records at startup
and updated after successful fsync-backed writes inside the serial intake queue.
Public requests do not reread the full private spool. Reads are paginated (50),
rate limited and no-store. Concurrent list changes can shift pagination offsets;
Refresh requests the current list. Archives are not public board history.

Tracking remains bearer-link based, not a verified academic identity or member
account inbox. No push notification alerts the sender to a new publication draft;
they must revisit their private tracking link. No continuous AI task runner was
added: authorized feedback can be considered during active development work.

## Independent review questions

1. Can consent, digest binding or private-history changes leave an unintended card public?
2. Does the public-only projection stay consistent after save, withdrawal, archive,
   redaction and process restart without exposing private metadata?
3. Are platform approval, GitHub export and qualified scientific acceptance still
   separate authorities in both API behavior and the interface?

Human publication acceptance, real user journey and anatomical review remain
separate from these technical checks. The change publishes no participant content.
