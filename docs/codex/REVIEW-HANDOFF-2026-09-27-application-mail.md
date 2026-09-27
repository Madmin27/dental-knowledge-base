# Independent review handoff — 2026-09-27 / application mail and first login

Status: prepared by implementer; focused source advisory received, independent
external review pending. Policy: [independent review](../INDEPENDENT-REVIEW.md).

## Pinned scope

- Base: `ffd22a636f14aa36768925ec6bc358172bb4258f`.
- Code: `dc16f560f5a8f6a605a48086f1b2b8ebcd40b48c`.
- [Comparison](https://github.com/Madmin27/dental-knowledge-base/compare/ffd22a636f14aa36768925ec6bc358172bb4258f...dc16f560f5a8f6a605a48086f1b2b8ebcd40b48c).
- Deployed: https://dentalopensource.org/review/, source and outbox migration
  installed 2026-09-27 around 07:00 UTC. Notification service exits successfully
  **waiting for SMTP configuration**. No actual mail delivery or owner onboarding
  has been completed. Public registration and photo intake remain closed.
- Prior handoff: private statistics / membership. Scientific scope is unchanged.

## Behavior and boundaries

Membership INSERT creates an outbox row transactionally. A dedicated systemd timer
and narrow DB role dispatch fixed owner notices without applicant content. Failed
mail retries independently of submission. Neither SMTP credentials nor worker DB
credentials are supplied to the public portal. Existing applications, anonymous
text contributions and photo uploads are not retroactively notified.

The local first-owner command reserves private random credentials, creates a
disabled IdP identity, commits its account and temporary manager appointment, then
enables the identity. It does not mark email verified. Password change, OTP and
email verification remain mandatory. Manager appointment grants no photo or
scientific review authority. No weak-password exception was installed.

## Evidence

- Network-disabled resource-limited PostgreSQL17 fixture: membership lifecycle
  including transactional rollback, queue access denial, retry scheduling and
  competing workers: **12 TAP tests passed** (11 child scenarios plus parent).
- Isolated fake IdP plus PostgreSQL bootstrap test: **1 passed**, checks unverified
  email, required actions, generated password length, private file mode, absence of
  secrets in output, no scientific grants and refusal to overwrite/recreate.
- Network-disabled Python tests: **23 passed**, including four SMTP/template tests.
  SMTP is mocked; these are not Gmail or actual Keycloak onboarding evidence.
- The first Docker test attempt failed before execution due to a missing mountpoint;
  corrected the disposable copy's empty node_modules mountpoint and reran successfully.
- Live read-only verification: notification DB role can SELECT/UPDATE only the
  outbox and cannot SELECT accounts/applications. Private initial credential0600;
  IdP enabled with emailVerified=false and required UPDATE_PASSWORD/CONFIGURE_TOTP/
  VERIFY_EMAIL. No private account values are included here.
- HTTPS session endpoint200 reports registrationEnabled=false and uploadsEnabled=false;
  anonymous manager dashboard303 to login. No browser/device or human acceptance
  claim for the new flow. Pre-change encrypted same-host backup verified.
- [Code CI](https://github.com/Madmin27/dental-knowledge-base/actions/runs/36301826391)
  was in progress when this snapshot was prepared; consult that run for its result.
  Earlier green CI is not attributed to this revision.

## Focused advisory and open questions

A separate local source-review agent inspected the notification/bootstrap files
without execution or production access. It found no demonstrated privilege or
secret disclosure in the reviewed scope. It called out three documented recovery
limits: SMTP-before-COMMIT duplication, cross-store bootstrap partial success, and
reserved credential files after failed role provisioning. This is a bounded
advisory, not a comprehensive security approval or a human identity attestation.

1. Does the trigger/outbox arrangement preserve the runtime/worker privilege split?
2. Are the documented cross-store reconciliation steps sufficient before real onboarding?
3. Does the operational queue procedure distinguish SMTP acceptance from delivery?

Reproduce with isolated synthetic commands in
[Application notifications](../APPLICATION-NOTIFICATIONS.md). No external provider
or real user inputs are needed for the regression tests.

## Limits and decision state

- Gmail application password missing; no notification or verification email sent.
  Owner must supply it privately, followed by actual delivery confirmation and
  Keycloak SMTP setup. No bypass for verified email or MFA was added.
- SMTP delivery is at least once: a crash after acceptance can duplicate mail;
  stable Message-ID does not guarantee deduplication. Restoring older DB can replay.
- Worker credentials/mail config are outside the current encrypted snapshot's
  configuration allowlist; DB dumps also omit global roles. Restore requires
  private credential/role re-establishment with mail paused. No off-host backup.
- Manager appointment expires after89days and needs explicit renewal. No automatic
  privilege escalation or public administrative signup exists.
- Pause `dental-notification.timer` to stop notifications; preserve outbox data.
  Prior application code is compatible with this additive trigger/table. Identity
  rollback must disable the exact prepared subject/account, not delete unrelated
  data or infer email verification.
- External independent review pending; scientific/human acceptance unchanged.
