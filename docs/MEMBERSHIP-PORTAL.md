# Membership, applications and photo intake

Implemented 2026-09-26. This extends the private photo pilot; it does not implement
scientific voting, publication approval or AI reconstruction.

## Participant workflow

`/review/register` initiates Keycloak registration using OIDC `prompt=create`.
Email verification, password and OTP are required before the application binds
an enabled account by **issuer + subject**. Email is contact information, never
a substitute identity key. Registration grants no contributor/reviewer role.

A signed-in member can apply for photo contribution, privacy review or the
anatomy team. The form collects name, institution, experience, professional
reference, motivation and consent to private administrative review. It does not
accept patient information or identity documents. English is requested for
shared application text; the interface supports English and Turkish.

Members see their own applications, reasons, authority expiry and revocation.
A pending application may be withdrawn; a final decision is not overwritten.
Reapplication creates a new record. Limit: five applications per rolling 30 days
and one pending application per role. Authority defaults to 30 days, maximum 90.

Photo contributors create private packages and upload JPEG/PNG after approval
and after intake is opened. Existing encryption, scanning, metadata removal,
quotas, resumable transfer, independent privacy inspection and erasure remain.
Photo intake automatically becomes unavailable when no active privacy reviewer
remains. An intake pause is rechecked inside upload/finalization transactions;
transactions already holding the shared lock finish before the pause commits.

## Administration

The operator appoints the initial membership manager separately. The first
registrant does **not** become administrator. Managers cannot appoint other
managers through this panel or approve their own applications.

The management area appears in the same signed-in workspace. It provides a
paginated application queue, private professional/contact information, approval
or rejection with reason and verification attestation, grant expiry and grant
revocation. Revocation removes the affected member's application sessions.
Decisions and intake changes are recorded. Managers can open/pause intake with
a reason; opening requires an active privacy team.

Manager status alone does not permit photo inspection. Privacy-review authority
has `photo_pilot` scope. Anatomy team acceptance has `anatomy_team` scope and is
only a team appointment; it grants no photo access, release authority or working
scientific ballot system. Those need separately implemented policies.

Authority-changing functions check enabled identity, current session, fresh MFA
(15 minutes), manager expiry, target status and revision inside an exclusive
transaction lock. Competing decisions cannot create two grants. Runtime cannot
write grants/managers directly. **The application runtime remains a trusted
security boundary:** it creates sessions, so compromise of its process or DB
credentials can forge application identity. SQL function checks do not establish
separation from a compromised runtime or database owner. A separate authority
service with independently verified credentials would be needed for that threat.

## Deployment and activation

1. Back up the existing portal and identity DB; apply `infra/review/migrate.mjs`
   with the private operator configuration. This also installs membership SQL
   and restricted grants. The new intake setting starts false.
2. Restart `dental-review.service`. Verify `/review/`, static membership module,
   anonymous session and health. No new public ports are needed.
3. Identify the initial human manager. Provision a verified account with
   `invite.mjs` using role `member` (no automatic photo/review grant), or bind an
   existing verified provider identity. Use the existing mode-0600 delivery flow.
4. Use `operator.mjs` with a mode-0600 request: `action: appoint-manager`,
   `accountId`, `expiresAt` (within 90 days), `contactVerified: true`, `grantedBy`
   and `evidenceReference`. Remove with `action: remove-manager` and `accountId`.
   Never invent human verification or place these private records in Git.
5. Configure authenticated SMTP over TLS and verify real delivery with the owner.
   The registration activation utility does not send a test message. Supply a
   mode-0600 request containing `enabled`, and for enabling `smtp` (Keycloak SMTP
   fields), `deliveryVerified: true`, `evidenceReference`; optional `operatorOtp`.
   Stop the portal during configuration, run:

   ```sh
   node infra/review/registration.mjs /etc/dental-review/operator.json /etc/dental-review/portal.json /PRIVATE/registration-request.json
   ```

   Review success/failure before restarting. This enables provider registration,
   email verification and password recovery and default email/OTP required
   actions, then enables application enrollment. Do not enable without SMTP and
   actual delivery evidence. On failure inspect both provider and application
   settings while the portal remains stopped; do not infer an atomic cross-system
   update. Keys/passwords stay in private files, never shell arguments or chat.
6. Named manager signs in, reviews applications, appoints an independent privacy
   reviewer, and opens photo intake from the panel after operational acceptance.

Keycloak mechanism reference: [Registration requested by client](https://www.keycloak.org/docs/latest/server_admin/#_registration-requested-by-client)
(`prompt=create`, rather than manually constructing action URLs).

## Tests and limits

- `npm test`: existing application tests.
- `TEST_REVIEW_DATABASE_URL` pointing to a disposable synthetic DB, then
  `node --test tests/membership-db.test.mjs tests/review-portal-db.test.mjs`.
- `tests/review-oidc.test.mjs`: isolated real Keycloak, signed token/OTP, zero-role
  enrollment call and registration form; not SMTP delivery or real onboarding.
- `tests/review-browser.mjs`: isolated Chrome, application submission, manager
  decision, escaped applicant text, English/Turkish, mobile and photo forms.

No named manager or SMTP configuration is inferred from deployment. Application
and decision records stay in the private DB and encrypted backups; no GitHub
issue or external AI transfer occurs. Application withdrawal is not erasure.
Account/application erasure is currently an operator-reviewed request, with
minimal authority audit retained as needed; there is no automatic retention job
for membership records yet. There is no email notification after decisions,
application discussion thread, reviewer assignment algorithm or automatic
academic acceptance. These limits must be communicated to pilot participants.
