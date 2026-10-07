# Private owner notifications and first login

## Current mail deployment — 7 October 2026

Remote mail is now used instead of Gmail SMTP. `notifications@dentalopensource.org`
sends identity verification and membership notices through
`mail.dentalopensource.org:587` with certificate-verified STARTTLS. Replies go to
`contact@dentalopensource.org`; the owner notice recipient is set separately in
root-only configuration. No applicant input controls recipients or headers.
Both accounts passed authenticated SMTP test sends and TLS/IMAP checks. SMTP
acceptance is not inbox delivery; owner confirmation is recorded separately.

The source `.env` is Git-ignored and mode0600. Its `contact` and `notifications`
values were copied into `/etc/dental-review/contact-mail.json` and
`/etc/dental-review/mail-setup.json`, respectively, both mode0600. Updating `.env`
alone does not rotate live credentials: update these private configurations and
the Keycloak SMTP settings together, then test. Public registration stays closed
until real onboarding/delivery verification; no emailVerified flag was bypassed.

The notification timer sends membership notices only. IMAP access was verified
read-only; continuous inbox polling and automatic correspondence are not configured.
Do not describe these mailboxes as continuously monitored by an AI.

## Notification behavior


New membership applications enter a PostgreSQL outbox in the same transaction as
submission, through an INSERT trigger. Rejected/rolled-back submissions do not
queue mail. Existing applications are not backfilled. Withdrawing or deciding an
application does not cancel its submission notice: the message describes a past
submission and the portal holds its current status. Anonymous atlas text feedback
and photo uploads are not membership applications and do not trigger this mail.

The dedicated `dental-notification.timer` checks every minute. Its separate DB
login has SELECT/UPDATE on the outbox only, with no access to applicants, photos,
accounts or applications. The public portal has no SMTP password or outbox write
authority. The trigger runs with the trusted schema owner's privileges and a fixed
search path. Mail configuration is a root-only systemd credential, not a public
asset. No notification endpoint or new WAN port is opened.

Messages contain only a fixed new-application notice and the HTTPS workspace link.
The recipient is the separately configured owner address (legacy Gmail setups default to the sender); applicant text never
sets headers, recipient, links or content. SMTP requires verified STARTTLS before
authentication. No applicant names, contact details, attachments or review findings
are sent. A stable Message-ID includes the opaque application UUID. Notification
access does not confer review authority.

## Delivery and operational limits

- The worker sends at most five notices per invocation. A row lock with SKIP LOCKED
  excludes competing workers; each SMTP child has a 30-second hard limit.
- Failures retain the record with exponential retry delay, capped at six hours.
  Only the fixed `smtp_failed` code is recorded, never provider response text.
- Missing credentials leave the queue untouched. Inspect systemd status/logs and
  private aggregate queue counts; exit success while waiting is not mail delivery.
- Delivery is **at least once**: SMTP acceptance followed by a crash or DB commit
  failure can duplicate a notice. A stable Message-ID does not guarantee deduping.
  SMTP acceptance also does not establish inbox delivery. No sent email is claimed
  without a real send; ask the recipient to confirm delivery before opening signup.
- Outbox rows are retained with their applications; no separate scheduled pruning
  is implemented. Restoring an older snapshot can replay notices. Pause the timer
  during recovery and reconcile the queue before restarting it.

## Deployment and credentials

Apply `apps/review-portal/notifications.sql` inside one transaction using the owner
DB credential (also included in `infra/review/migrate.mjs`). Provision the dedicated
role once using:

```sh
node infra/review/notification-setup.mjs /etc/dental-review/operator.json /etc/dental-review/notification.json
```

This trusted operator command uses the existing local PostgreSQL administrator
credential to create the narrow role. It reserves a mode0600 output file first;
a failure requires checking the role and private file, not blindly rerunning or
printing the credential. Install the supplied systemd service/timer and their
read-only bind destinations. The timer reloads mail credentials each invocation.

For the historical Gmail setup only, enter its application password with `infra/review/gmail-password.py`, as
explained in [private dashboard](PRIVATE-DASHBOARD.md). The owner requested mail
notifications, but no password is inferred from that authorization. Normal Gmail
passwords are not used. Once configured, send a clearly identified test notice to
the owner and confirm receipt. Configure Keycloak SMTP with the same private
settings, then exercise actual verification and login before opening public
registration through `infra/review/registration.mjs`. Do not mark
`deliveryVerified=true` solely on SMTP acceptance.

The current encrypted DB snapshot includes outbox rows. Its configuration allowlist
**does not include** `notification.json`, `mail-setup.json` , `contact-mail.json` or the initial-password
file, and pg_dump does not back up global login roles. Preserve/recreate these
credentials separately in a private recovery workflow; do not assume a DB restore
makes mail work. Disable mail during a restore rehearsal.

## First owner bootstrap

`infra/review/bootstrap-owner.mjs` is a local operator-only command for an empty
account database. It uses the privately configured owner mailbox, generates a
strong temporary password and reserves a mode0600 delivery file. The public signup
route cannot call it. Do not publish that file or paste its contents into chat.

The initial identity is created disabled and with **emailVerified=false**. Only
after the DB account and 89-day manager appointment commit is the identity enabled.
The first login requires UPDATE_PASSWORD, CONFIGURE_TOTP and VERIFY_EMAIL; the
portal independently checks verified email and password+OTP before issuing a
session. Supplying a mailbox address is not mailbox verification. The manager gets
no photo-review or scientific-review grants. Their placeholder display name is
private and can be corrected at onboarding. Renew the appointment explicitly
before expiry; there is no permanent hidden administrator bypass.

`123456` is not used: the existing realm policy remains at least 14 characters.
Retrieve the random temporary credential from the private delivery file on the
server; remove that delivery copy after successful password change. Login cannot
complete email verification before the identity provider's SMTP is configured.

Identity and PostgreSQL cannot commit atomically. If setup fails before the DB
commit, the script rolls back and attempts to remove its disabled identity. After
commit, an enable failure leaves a disabled identity plus the account/appointment;
a delivery-file update failure may leave an enabled identity with `preparing` in
the file. Compare the privately recorded account/subject, IdP enabled/actions state
and DB appointment, then complete only the missing step. Never reset another
account, mark email verified, or rerun with fabricated verification evidence.

## Reproducible checks

In an isolated disposable database run `node --test tests/membership-db.test.mjs
 tests/owner-bootstrap-db.test.mjs` with `TEST_REVIEW_DATABASE_URL` (synthetic only).
The bootstrap test uses a fake IdP on isolated loopback8079; it does not establish
real Keycloak onboarding or Gmail delivery. `python3 -m unittest discover -s tests
-v` covers fixed recipient/template, header input rejection, TLS ordering, SMTP
refusal and missing credentials. Use network-disabled, resource-limited test
containers and synthetic input as documented by the project's review procedure.
