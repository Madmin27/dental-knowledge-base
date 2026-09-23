# Private photograph pilot

Implementation milestone: 2026-09-23. Entry: https://dentalopensource.org/review/.
English default; Turkish interface available. Contributions are requested in
English. The interface does not infer the language or translate clinical content
through an external service.

## Implemented workflow

1. An operator verifies a named person's identity/contact and assigns an expiring
   `photo_pilot` grant. Institutional email or job title does not grant authority.
2. Keycloak requires password and OTP. The app validates issuer, subject, audience,
   nonce, one-use state, PKCE, recent authentication, verified email and actual
   `pwd` + `otp` authentication-method claims. Tokens stay on the server.
3. A contributor creates a single-specimen package with purpose, FDI/unknown,
   authority reference and separate private-inspection/processing permissions.
4. JPEG/PNG bytes upload in bounded resumable chunks to encrypted storage outside
   Git/webroot. The original filename is not sent to the API or stored.
5. A network-disabled, unprivileged processor scans with ClamAV and fully decodes
   with sharp/libvips. It creates an orientation-normalised, metadata-free JPEG;
   transparent backgrounds are flattened to white. Original bytes remain private
   and encrypted, never available through an HTTP raw-file route.
6. A separately authorised human views the derivative at full size, checks pixels,
   metadata, authority and purpose, records risk tags and an English rationale,
   and chooses `needs_information`, `rejected`, or `privacy_cleared`.
7. The decision binds the exact derivative hash and revision. Stale decisions and
   self-review fail. Previous decisions remain visible until privacy erasure.

`privacy_cleared` means **private photo inspection only**. It is not permission for
AI, training, public photographs, public models, anatomical acceptance or a vote.
Those permissions remain false and no generation/publication endpoints exist.
There is no GitHub issue transfer. No OCR accuracy or automatic de-identification
claim is made; identifying pixel content must be assessed by the human reviewer.
JPEG/PNG radiograph exports, facial images, volumes, ZIP, PDF, SVG and DICOM are
outside this pilot. The server rejects a declared non-photo modality; it cannot
prove from file bytes that a dishonest uploader has not supplied a radiograph.
Human review must reject/refer out-of-scope or identifying material.

## Scope, limits and retention

- 20 MiB/file; 40 million decoded pixels; one image/page; 1 MiB upload chunks.
- 120 files and 512 MiB/package; 1 GiB/account; 512 MiB/account/day; 20 GiB global
  reserved source quota; 2 GiB free-space reserve. Derivatives/ciphertext overhead
  are additional physical storage, protected by the free-space check and monitoring.
- 20 active packages/account; 1,000 active packages total. Reservations are atomic
  in PostgreSQL; daily budget is not refunded by deletion to prevent churn abuse.
- One finalization at a time; four concurrent HTTP responses, with `Retry-After`
  on overload. Proxy buffering of private uploads/responses is disabled.
- A failed/changing scanner, stale definitions (>72h), decoder error, oversized
  pixels, timeout or interrupted upload does not produce privacy clearance.
- Complete pilot packages expire after 30 days. Packages with no reviewable photo
  expire after 24 hours. Cleanup runs hourly and at startup. This is a pilot rule,
  not the future retention policy for published academic decisions.
- Owners may erase earlier even after their upload grant expires/revokes. Disabled
  accounts use a verified operator-assisted erasure request, below.
- Active files and private prose are purged; minimal opaque erasure/audit references
  remain. Encrypted backups retain at most 14 successful daily snapshots. This
  is snapshot-count retention, not a guarantee if the backup timer stops working.

The photo endpoint has no arbitrary remote URL fetch. Input is not sent to an
external AI provider or the advisory-team gateway. A visually convincing photo
or a clean malware scan is not scientific or privacy approval.

## Deployment boundaries

| Component | Local binding / state |
| --- | --- |
| Existing atlas/text intake | Existing `dental-preview.service`, loopback 3057 |
| Private portal | `dental-review.service`, loopback 3059 |
| Keycloak 26.7.4 | Compose `identity`, loopback 8079; `/auth/realms/dental/` and resources proxied |
| Dedicated PostgreSQL 17 | Compose `database`, loopback 55433; independent from development DB |
| Photo processor | No network, private Unix socket; 1 CPU, 1536 MiB, 32 processes |
| ClamAV definitions updater | Separate update network; no uploaded files, DB credentials or vault key |
| Encrypted photo vault / erasure journal | `/var/lib/dental-review/vault`, `/var/lib/dental-review/erasures.jsonl` |
| Credentials | `/etc/dental-review/` root-only parent; application receives only `portal.json` via systemd credential |
| Private snapshots | `/var/backups/dental-review/`; no web route, no Git files |

The runtime DB role cannot change accounts/grants or create tables. Operator
grant/revoke tools and application transactions coordinate through a PostgreSQL
advisory lock; grants are checked inside critical transactions. Account disable
and grant revocation remove application sessions. Direct changes in Keycloak do
not themselves invalidate an already issued app session: disable the application
account with the operator tool too. Idle timeout is 15 minutes; absolute timeout
is one hour; viewing others' private data and decisions require authentication
within 15 minutes. Re-authentication rotates the application session.

The initial bootstrap operator is local infrastructure setup only, not a shared
scientific reviewer. The master realm/admin console is not publicly proxied.
Named infrastructure-admin enrollment and removal of bootstrap credentials are
part of owner onboarding; no real identities are invented by deployment scripts.

Templates: `infra/review/compose.yml`, `dental-review.service`, and
`nginx.locations.conf`. `prepare.mjs` refuses to overwrite an existing private
configuration. `migrate.mjs` runs with the migration-owner credential, never the
runtime connection. `npm ci --ignore-scripts` supplies the maintained OIDC client.
The processor is built from its own locked dependency set and pinned image digests.

## First accounts and pilot opening

The owner must provide the first named account and a different privacy reviewer.
The pending question asks for names/contact details, **not passwords**. Identity
and contact verification must be completed by an accountable human; supplying an
email address alone is not verification.

Prepare a local mode-0600 JSON request outside the repository:

```json
{
  "username": "example-contributor",
  "email": "verified-person@example.invalid",
  "firstName": "Example",
  "lastName": "Person",
  "identityChecked": true,
  "contactVerified": true,
  "role": "photo_contributor",
  "expiresAt": "REPLACE_WITH_FUTURE_ISO_TIME_WITHIN_90_DAYS",
  "grantedBy": "verified-operator-reference",
  "evidenceReference": "private-verification-record-reference"
}
```

These are documentation placeholders. Do not run them as actual verification.
Use `privacy_reviewer` only after the owner explicitly appoints that individual
to the private photo pilot. This role can inspect all nondeleted photo-pilot
packages, not future clinical modalities or unrelated projects.

```sh
node infra/review/invite.mjs /etc/dental-review/operator.json /PRIVATE/request.json /PRIVATE/first-access.json
```

The tool provisions the identity, binds exact issuer/subject, records the scoped
grant, and writes a mode-0600 temporary-password delivery file. It sends no email.
Deliver through a verified private channel. First access changes the password
and enrolls TOTP; sign in again afterward so the app sees actual OTP execution.
Secure SMTP/self-service recovery is not configured. For recovery, disable the
app account/revoke sessions first, independently verify the person, reset through
Keycloak's private administration, then reassess grants; do not bypass MFA.

`operator.mjs` supports `bind`, `grant`, `revoke`, and `disable`, from mode-0600
request files. A grant request includes accountId/role/expiresAt/grantedBy/
evidenceReference; a revocation includes grantId/reason. It never grants scientific
voting or publication authority. Accounts can have both pilot roles, but can never
privacy-clear their own contribution.

Only after named people, purpose/retention acknowledgement and acceptance checks:
set `REVIEW_UPLOADS_ENABLED=true` in a `dental-review.service` override and restart.
The shipped and currently deployed default is **false**. No real photo has been
accepted as part of the implementation tests.

## Erasure and recovery

The HMAC-chained journal is fsynced before DB erasure. The running application also
consults that journal, so a DB rollback after the journal append cannot restore
reads. An in-flight isolated job can retain volatile buffers/tmpfs until its bounded
completion (at most 60 seconds); its result must recheck the object and cannot
revive it. Do not describe a deletion response as immediate physical erasure of
all volatile buffers or retained backup copies.
Journal corruption/divergence fails closed; never truncate it silently.

Disabled-account erasure: verify the owner's request; stop the portal to prevent
concurrent journal writers; put `{packageId, ownerId, verifiedOwnerRequest:true}`
in a mode-0600 private request file, then run:

```sh
node infra/review/erase.mjs /etc/dental-review/operator.json /etc/dental-review/portal.json /PRIVATE/erasure-request.json /var/lib/dental-review
```

Restart afterward. Active bytes/prose are removed; the journal continues to block
old snapshots. Do not describe retained backup copies as physically erased yet.

`dental-review-backup.timer` runs daily at 04:15 with up to ten minutes jitter.
The backup briefly stops the portal for a consistent DB/vault/journal snapshot,
includes the identity DB and required configuration, encrypts with a separately
stored key, verifies member hashes and only then rotates successful snapshots.
It is **same-host protection**, not disaster recovery. Monitor timer failures,
snapshot age, free disk and scanner freshness. A future second host is still needed.

```sh
python3 infra/review/backup.py snapshot
python3 infra/review/backup.py verify --archive /PRIVATE/snapshot.tar.gpg
python3 infra/review/backup.py extract --archive /PRIVATE/snapshot.tar.gpg --target /NEW/EMPTY-RESTORE-PATH --current-ledger /INDEPENDENT-CURRENT/erasures.jsonl
```

Extraction refuses existing targets and any non-allowlisted member, link, excessive
size, digest mismatch or non-prefix erasure history. **An old snapshot's journal
cannot substitute for the independently preserved latest journal.** If current
history freshness cannot be established, keep reads/workers off and obtain an
operator decision. Do not automatically restore over live data.

Recovery sequence: isolated target → create DB roles with protected configuration
→ restore portal/identity DBs → run migration/grants → install encrypted objects
and the reconciled current journal → revoke all app sessions/login attempts →
startup applies erasures and purges before listening → verify counts/hashes and
named-account login → switch traffic. Realm export alone is not an identity backup.

## Validation and remaining product work

- `npm test`: existing checks plus pure permission/encryption checks.
- `npm run test:review-db` with `TEST_REVIEW_DATABASE_URL` targeting a **disposable**
  database: runtime role, IDOR, CSRF, quota race, revision race, revoked permission,
  self-review, scanner outage, chunk retries, erase/restore and late-worker tests.
  CI runs this after the existing synthetic DB job.
- `tests/photo-processor.test.mjs`: optional, separate Unix-socket fixture with
  actual definitions/ClamAV/sharp; synthetic pixels only.
- `tests/review-oidc.test.mjs`: optional, isolated synthetic Keycloak; real password
  and OTP flow, OIDC validation, callback replay and wrong-state rejection.
- `tests/review-browser.mjs`: no-network Chrome fixture; English desktop, Turkish
  mobile and package form. Headless evidence is not actual-device acceptance.

Still separate: real participant onboarding, full discussion/clarification threads,
rights adjudication/publication, named academic reviewer qualifications, panel voting,
radiograph/volume intake, AI reconstruction, off-host recovery and independent
security review. `needs_information` records a reason; this pilot does not yet have
an owner/reviewer message thread. Request a replacement package or coordinate
privately with the operator; never move images into GitHub issues.

Provider references: [Keycloak production containers](https://www.keycloak.org/server/containers),
[reverse proxy](https://www.keycloak.org/server/reverseproxy),
[authentication-method mapping](https://www.keycloak.org/admin-api/protocol-mappers),
[basic scope migration](https://www.keycloak.org/docs/26.7.2/upgrading/),
[openid-client](https://github.com/panva/openid-client).
