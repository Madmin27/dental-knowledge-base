# Independent review handoff — 2026-09-23 / private photo pilot

Status: prepared by implementer; independent milestone review pending.
Policy: [independent review](../INDEPENDENT-REVIEW.md), issue #4.

## Pinned scope

- Base: `169fbe4b00406847914d6c20fc6f913635f5782c`.
- Code target: `c0c31f240b2674360cd8b5355ce0d5230e230f28`.
- [Compare](https://github.com/Madmin27/dental-knowledge-base/compare/169fbe4b00406847914d6c20fc6f913635f5782c...c0c31f240b2674360cd8b5355ce0d5230e230f28).
- Deployed: https://dentalopensource.org/review/; target source bound read-only
  into service, restarted 2026-09-23 20:32 UTC. Processor revision label matches
  target; image `sha256:2ef2d3c3a807cb1e055080c0d920eebbd9a8ac1e30ecf6317b755ce8be13b39a`.
- [Operations and limitations](../PRIVATE-PHOTO-PILOT.md); ADR0007/0008.

## Behavior and boundaries

Adds a separate English/Turkish private photo workspace: pre-bound named
accounts, Keycloak password plus OTP, scoped expiring contributor/reviewer
grants, resumable JPEG/PNG intake, encrypted storage outside the webroot,
network-isolated malware scanning and metadata removal, private previews and
version-bound human privacy decisions. A contributor cannot review their own
submission. No raw download route or public photo publication exists.

Owner erasure remains available after the upload grant expires. A durable
authenticated journal prevents old snapshots or late processing from reviving
deleted records. Access checks the journal again after acquiring a row lock.
Runtime database authority cannot grant roles or modify account authority.

**Real intake is disabled.** Production accounts remain unassigned; the owner
must identify the initial account holder and a separate privacy reviewer.
Named-human identity/contact verification and private credential delivery remain
operator actions. No participant was invented and no clinical images were used.
AI reconstruction, radiographs/volumes, anatomical acceptance, public release,
ballots and a complete discussion system are outside this delivered slice.

## Evidence

- Local isolated `npm test`: 101 TAP tests passed.
- Python guard/backup tests: 19 passed; tracked clinical-data guard passed.
- `tests/review-portal-db.test.mjs`: 14 scenarios plus parent (15 TAP tests)
  passed against disposable PostgreSQL using the restricted runtime role.
  Includes concurrent quota, cross-account access, revoked/expired authority,
  CSRF/origin, stale/self review, erase/rollback, waiting-lock race, old restore,
  and late worker completion. Reproduce with `TEST_REVIEW_DATABASE_URL` pointing
  **only to a disposable synthetic database**, then `npm run test:review-db`.
- `tests/photo-processor.test.mjs`: four cases plus parent (5 TAP tests) passed
  against actual isolated ClamAV and sharp, including EXIF removal, signature
  mismatch, truncation and an oversized-image fixture with valid header CRC.
  Requires `TEST_PHOTO_PROCESSOR_SOCKET` and the isolated processor.
- `tests/review-oidc.test.mjs`: real isolated Keycloak password/OTP exchange,
  signed ID token verification and state/replay rejection passed (1 test).
  Requires a synthetic realm and `TEST_OIDC_ISSUER`; never use production users.
- `tests/review-browser.mjs`: headless Chrome synthetic contributor/reviewer
  forms, English/Turkish and mobile layout passed. Local screenshots are
  temporary proofs, not downloadable GitHub artifacts or real-device evidence.
- Encrypted snapshot verified; portal and identity SQL were restored into two
  separate disposable PostgreSQL databases (11 portal tables, no users; dental
  realm present), then removed. Final post-deployment encrypted snapshot also
  verified. Same-host recovery only; not disaster recovery.
- HTTPS `/`, `/review/`, health, anonymous session and identity discovery return
  200. Session reports unauthenticated and uploads disabled. These requests were
  from this server, not an independent external network.
- Portal, identity and database bind only loopback (3059/8079/55433); processor
  has no network. Backup timer active. Backup briefly stops the portal; a probe
  immediately after restart saw 502, and the subsequent readiness checks passed.
- CI status is separate: see [Repository checks](https://github.com/Madmin27/dental-knowledge-base/actions/workflows/repository-checks.yml)
  for the pushed handoff revision. It is not inferred from local tests.

Focused advisory source review identified ownership-after-revocation, write
durability and erasure-journal/SQL race gaps. Fixes and negative tests are included.
This bounded AI review is not a full independent audit or human privacy approval.

## Independent review questions

1. Can any stale session, grant or competing transaction bypass ownership,
   privacy-review separation or durable erasure? Exercise synthetic concurrency.
2. Does decoder isolation, encrypted storage and backup reconciliation preserve
   confidentiality and deletion across process crashes and restore attempts?
3. Are the invitation/contact-verification steps and restricted review UI clear
   enough for the named human pilot without implying publication authority?

## Known limits and decision state

- Independent full milestone review and qualified human acceptance: pending.
- Privacy approval does not confer anatomy, rights or publication approval.
- No real-user onboarding, real-device upload performance or clinical acceptance
  has been demonstrated. Automated checks use synthetic material only.
- No off-host backup; loss of this host may lose both data and recovery material.
- In-flight processing may retain volatile/tmpfs bytes until its bounded job
  ends (up to 60 seconds); it cannot re-persist an erased package.
- `needs_information` records rationale; a full clarification thread and
  self-service email recovery are not implemented. Operators coordinate privately.
- A JPEG signature cannot establish that content is an in-scope tooth photo;
  qualified human privacy/modality review remains necessary.
- Rollback: keep intake disabled, stop the review service and remove its Nginx
  include if needed; preserve encrypted state/journal and backups. Do not restore
  old snapshots without current-journal reconciliation. Atlas base remains above.
- Human maintainer supplies named participants; operator verifies/binds accounts
  and arranges secure initial access before enabling real intake. No invented
  assignees, external messages or automatic issue closure.
