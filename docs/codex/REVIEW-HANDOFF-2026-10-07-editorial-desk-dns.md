# Independent review handoff — 7 October 2026 / contribution desk and DNS delegation

Status: prepared by implementer; independent review pending.
Policy: [independent review](../INDEPENDENT-REVIEW.md), issue #4.

## Pinned scope

- Base: `f9aa98c731fcd15c319a205eea406762ca1c4b57`.
- Code target: `894d124314ba4144cd240d328c81b92631589d65`.
- [Compare](https://github.com/Madmin27/dental-knowledge-base/compare/f9aa98c731fcd15c319a205eea406762ca1c4b57...894d124314ba4144cd240d328c81b92631589d65).
- Deployment: https://dentalopensource.org, 7 October 2026; preview and portal
  services restarted after encrypted backups and a targeted additive DB migration.
- Scope: private text contribution operations and DNS-01 renewal; no anatomy,
  source geometry, reconstruction or clinical publication changes.

## Behavior and boundaries

Previously, the private text intake had contributor tracking and an operator CLI,
but no authenticated editorial browser desk. `/review/contributions` now provides
triage ownership, priority, follow-up dates and contributor-visible reasoned
responses. A current, independently verified account with an expiring editor or
membership-manager appointment and a fresh session is required. A limited editor
appointment grants neither membership management nor clinical-photo authority.

Technical contributions may have a manually sanitized English public summary.
The contributor must approve its exact title/body/version; a different editor
must check privacy, rights and technical scope. Any ordinary event invalidates
the draft; changed text requires new consent. Export checks both editors' current
authority, pins the digest and serializes the final read. Withdrawal remains
available after archive/history saturation and is retry-safe. Redaction removes
publication text. Private tracking reads omit internal editor account IDs.

Export contains only the approved title/body and metadata. There is no GitHub API
publisher, no automatic issue creation and no remote-status synchronization. A
human manually posts the approved summary, then records an issue URL. That URL is
not evidence that the remote content matches. Scientific discussions, attachments,
ballots and patient information must not be copied to public issues.

The remote parent DNS zone now delegates `_acme-challenge.dentalopensource.org`
to `ns1-acme.minen.com.tr`. Local BIND serves only this delegated validation child
zone for renewal, using an exact-owner TSIG update policy. Existing TCP/UDP 53
routing is reused. No modem port 80 reassignment is needed. The earlier HTTP-01
preparation was removed after the shared-modem constraint became clear.

## Evidence

- `npm test`: 107 passing cases, no failures, in an isolated network-disabled,
  read-only-source container with resource limits.
- Focused contribution tests: 17 passing; membership/desk PostgreSQL suite:
  13 passing TAP results (12 scenarios plus parent), using isolated synthetic DB.
- Python suite: 23 passing tests, including restore history validation.
- Browser fixture: English desktop and Turkish mobile, draft submission,
  authority-loss DOM clearing, no overflow or JS exceptions. Screenshot inspected.
  One repeat with a 32 MiB temporary filesystem failed screenshot capture; the
  same test passed with 128 MiB temporary space. These are synthetic headless
  checks, not human account/device acceptance.
- CI: bootstrap and database jobs both passed in [code run](https://github.com/Madmin27/dental-knowledge-base/actions/runs/37652036465).
- Live HTTPS: `/health`, `/review/health` and both language variants of
  `/contribution-process` return 200; unauthenticated `/review/api/desk` returns
  401 and GET `/review/contributions` returns 303 to login. These requests did
  not read real private contribution records.
- Encrypted text-intake and portal/identity backups succeeded. Portal archive
  integrity was verified; this run was not a fresh database restore rehearsal.
- Public DNS resolver confirms the ACME NS delegation and web A record. Certificate
  DNS-01 `certbot renew --cert-name dentalopensource.org --dry-run
  --run-deploy-hooks` succeeded at 19:28 Istanbul time, including staging issuance
  and Nginx configuration-test/reload hook. `certbot.timer` is active. This dry run
  did not replace the production certificate, which expires 22 December 2026.

## Independent review questions

Use a synthetic isolated environment; do not retrieve live contributor records.

1. Can stale text, revoked editor authority, contributor identity spoofing or
   concurrent consent withdrawal bypass the exact-draft export gate?
2. Do authenticated role boundaries, CSRF checks, browser clearing and private
   projections keep editor operations separate from public and photo workflows?
3. Are archive, capacity, privacy-redaction and restore-history cases consistent
   with append-only lineage and fail-closed reconciliation?

A bounded local AI source advisory found export text drift and withdrawal retry
issues during implementation; both were corrected before the pinned commit. This
is not the external independent audit or a qualified academic acceptance.

## Known limits and next actions

- SMTP is not configured/verified. Real owner verification/login and appointment
  of two actual intake editors are pending. Registration and clinical uploads
  remain closed. The technical deployment does not imply a staffed service.
- Text intake does not yet send assignment/new-record emails. The existing
  membership notification outbox is a separate subsystem awaiting working SMTP.
- A contributor tracking secret proves possession, not verified academic identity.
  Editors and operators remain trusted; root/moderator credentials can read the
  private intake. Withdrawals cannot recall already published/downloaded copies.
- There are no expert scientific ballot rounds, adopted quorum, public acceptance
  percentages or implemented private scientific discussion workspace in this change.
  See [operating policy](../CONTRIBUTION-OPERATING-POLICY.md) and ADR0007.
- Same-host encrypted backups and one ACME nameserver are not disaster recovery
  or DNS redundancy. Existing unrelated Nginx duplicate-vhost warnings remain.
- Rollback: disable the desk drop-in, restore the prior code and restart Dental
  services; the added table is backward-compatible and may be retained. Do not
  revert DNS hooks to the parent-zone update while remote delegation is active.
  Root-only server configuration backups are under `/var/backups/`.

## Decision state

Independent review and real human editor rehearsal: pending.
Qualified anatomical acceptance: unchanged, pending.
No participant contribution or GitHub issue was publicly posted by this change.
