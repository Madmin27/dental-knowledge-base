# Independent review handoff — 2026-09-26 / membership panel

Status: prepared by implementer; independent milestone review pending.
Policy: [independent review](../INDEPENDENT-REVIEW.md).

## Pinned scope

- Base: `b1c67b1e5c129f2810fb93dc430395d2a9cc8140`.
- Code: `911912b0c24679e09849c43c96ff43791c10ff27`.
- [Compare](https://github.com/Madmin27/dental-knowledge-base/compare/b1c67b1e5c129f2810fb93dc430395d2a9cc8140...911912b0c24679e09849c43c96ff43791c10ff27).
- Deployed source/service: code above, 2026-09-26 19:59 UTC,
  https://dentalopensource.org/review/ . Existing image scanner unchanged.
- Continuation of private-photo pilot; [operations](../MEMBERSHIP-PORTAL.md).

## Behavior

Adds OIDC self-registration entry and zero-role verified enrollment, member
applications/status/withdrawal, human manager queue/decision/revocation, scoped
1–90-day authority and panel-controlled photo intake. Membership manager does
not automatically gain photo access or scientific authority. First registration
never becomes admin; first manager is appointed privately by the operator.

Anatomy appointments have separate `anatomy_team` scope, not photo-review scope.
The photo workflow remains private and independent from academic publication.
Authority decisions and intake changes carry reasons and audit records; no
external AI or GitHub contribution-data transfer is introduced.

## Evidence

- `npm test`: passed (existing 101 TAP tests).
- Existing private-photo PostgreSQL suite: 14 scenarios plus parent passed.
- New membership PostgreSQL suite: 9 scenarios plus parent passed. Includes
  disabled enrollment, cross-member access, duplicate application, self-approval,
  unverified approval, competing decisions, expired manager/session, revocation,
  scope boundaries and upload waiting behind intake pause. CI runs it too.
- Real isolated Keycloak test passed: signed password/OTP login, enrollment call,
  callback replay/state checks, and `prompt=create` registration form. It does
  **not** demonstrate real SMTP delivery or complete real-user registration.
- Isolated Chrome passed: English landing, Turkish mobile, contribution form,
  membership submission, administrator decision, HTML-as-text applicant rendering,
  privacy-decision form, no overflow or JavaScript exceptions. Screenshots were
  inspected locally; they are not downloadable GitHub artifacts or real-device
  acceptance. Reproduce with `tests/review-browser.mjs` in an isolated fixture.
- Pre-migration encrypted portal/identity backup created and integrity verified.
  This run did not repeat the prior full database restoration rehearsal.
- HTTPS `/`, `/review/`, membership module, session and health return 200.
  Production manager/application counts are zero; registration and intake false.
  These checks originate on the server, not from an independent external network.
- [CI workflow](https://github.com/Madmin27/dental-knowledge-base/actions/workflows/repository-checks.yml):
  verify the pushed documentation revision; local tests do not establish CI status.

## Focused advisory review and trust boundaries

Focused read-only AI advice identified an intake race: the initial HTTP check
preceded reading the body. Intake is now rechecked inside shared-lock repository
transactions, mutually exclusive with manager pause/revoke. A negative test
exercises the waiting upload. A job already running may finish computation but
cannot persist its final derivative after the pause commits.

The review also identified a **runtime-compromise limitation**: SQL functions
check application sessions, but the same trusted runtime creates those sessions.
A compromised runtime/DB credential can fabricate a manager session. Direct
runtime writes to grants/managers are denied; this is not an independent security
boundary against a fully compromised runtime. No HTTP SQL-injection path was
identified. Operations documentation explicitly states this trust model. A
separate credential-verifying authority service would be a further architecture
change. Do not claim complete security audit or independent human acceptance.

## Review questions

1. Can any participant bypass fresh-manager checks, self-approval restrictions,
   revision locking or separate anatomy/privacy scopes through the HTTP APIs?
2. Are intake pausing, reviewer expiry and finalization retries consistent under
   concurrency, without reviving deleted packages or granting access to managers?
3. Does the named-human/SMTP activation process communicate what has and has not
   been verified, while protecting credentials and private application records?

## Remaining work and decision state

- **Activation pending owner input:** initial manager name/contact and SMTP
  service; verified delivery before registration is enabled. No invented users.
- No real participant accepted, verified delivery demonstrated, reviewer team
  appointed, or clinical upload accepted by this change.
- No automatic reviewer approval, notification mail, application discussion,
  scientific ballots or publication workflow delivered. Self-registration is
  implemented but closed in production until email delivery is configured.
- Membership records have no automatic retention job; withdrawal is not erasure.
  Erasure requests remain operator-reviewed with limited authority audit retention.
- Backups remain same-host; no disaster-recovery claim.
- Rollback: stop review service, restore base source, keep private DB/state/ledger.
  The migration is additive apart from expanded grant checks. Do not blindly
  downgrade grants after anatomy-team appointments; coordinate with maintainer.
- Full independent review, human privacy acceptance and academic acceptance:
  pending. AI advice and CI are not those approvals.
