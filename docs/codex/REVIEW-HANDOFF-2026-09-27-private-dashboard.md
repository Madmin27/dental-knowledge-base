# Independent review handoff — 2026-09-27 / private dashboard

Prepared by implementer; full independent review pending.
Policy: [independent review](../INDEPENDENT-REVIEW.md).

## Pinned scope

- Base: `f52878be1ed7ad8bd1cf7712f90382ba46e012a8`.
- Code target: `98b1587a0004c56de0990ec12781315222af0039`.
- [Compare](https://github.com/Madmin27/dental-knowledge-base/compare/f52878be1ed7ad8bd1cf7712f90382ba46e012a8...98b1587a0004c56de0990ec12781315222af0039).
- Deployed target: 2026-09-27 06:05 UTC; `/review/admin` on dentalopensource.org.
- [Operations and exact counter definitions](../PRIVATE-DASHBOARD.md).

## Delivered behavior

An authenticated manager with recent MFA can open a separate private statistics
page: membership/application status, current roles, retained photo states, queue
age and 7/30/90-day activity. The dashboard links to existing management actions.
Neither normal members nor a privacy reviewer without manager authority can read
its HTML or data API. No participant names, addresses, application prose, image
content or raw storage paths are included in aggregate responses.

Public page usage is recorded as allowlisted successful HTML response counts.
No query strings, identifiers, IPs, cookies, referrers, user agents or device data
are stored by this collector. Counts include bots/reloads/operator requests and
must not be described as unique people. Collection starts now; no historic
traffic was invented. Snapshots retain 90 UTC days, batched writes and a minute
heartbeat. Stale/unavailable counters are distinguished from zero activity.

The owner-selected temporary email remains only in a private server draft. A
local no-echo app-password helper is provided. No credential was invented, no
mail was sent, no contact verification claimed, and no manager was fabricated.
Registration and photo intake remain closed pending real onboarding/delivery.

## Evidence

- `npm test` passed, including three new counter persistence/privacy/retention
  tests (104 TAP tests across suites). Final heartbeat change rechecked with the
  targeted counter suite.
- `tests/membership-db.test.mjs`: ten scenarios plus parent passed (11 TAP tests).
  Added live isolated PostgreSQL aggregates and HTTP checks: anonymous/member
  rejection, manager access, expired session rejection, no-store and deleted
  package exclusion. No production identities or clinical images used.
- Targeted isolated Chrome: `TEST_STATS_ONLY=1` with
  `tests/review-browser.mjs` passed desktop/mobile, English/Turkish, permission
  failure clearing, overflow and JavaScript-exception checks. Screenshot visually
  inspected locally; temporary artifacts are not downloadable GitHub evidence.
  The combined browser sequence encountered Chrome process/screenshot failures;
  it is not reported as a complete passing combined run. The new panel was
  successfully tested separately in the same bounded, network-isolated setup.
- Focused advisory source inspection found no direct auth/PII blocker and noted
  stale snapshots could resemble zero later traffic. Heartbeat display and
  unknown later-day values were added. This is bounded AI advice, not a full
  independent security audit or human privacy/academic approval.
- Live operational verification: `/` and review health/session 200; anonymous
  `/review/admin` redirects to login (303), statistics API401, raw `/usage.json`
  404. Registration/intake false. These checks originate on this server, not
  an independent external network.
- Dedicated aggregate directory/group installed. Preview has write access;
  review has a systemd read-only path. File mode0640 verified. No private vault
  or database credential was shared with preview. No new public ports/schema.
- CI is separate: check the pushed revision in
  [Repository checks](https://github.com/Madmin27/dental-knowledge-base/actions/workflows/repository-checks.yml).

## Review questions and limits

1. Do manager/MFA/session checks cover both HTML and aggregate API, including
   expiry/revocation, without relying on a secret URL?
2. Can any non-allowlisted request data reach the usage snapshot or dashboard?
3. Are missing/stale data, bot/reload counts and photo-size semantics clear?

All application-runtime trust limitations in the previous handoff still apply.
Counts are approximate operational trends, not billing/tamper-proof evidence.
The older anonymous text inbox is outside these membership/photo totals.
No geographic, unique-visitor or conversion tracking is implemented.

SMTP authentication, explicitly authorized delivery test, mailbox confirmation
and actual owner-manager login remain pending. Sending from a Gmail account will
expose its sender address to recipients even if the website does not show it.
Clinical contribution acceptance and academic validation remain human decisions.

Rollback: remove only the metrics drop-ins, daemon-reload/restart these two Dental
services, and restore the base source if needed. Preserve private portal data and
credentials; the aggregate file is separate from clinical state. No other service
or independent review issue was modified or closed.
