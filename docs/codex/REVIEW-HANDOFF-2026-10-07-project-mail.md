# Independent review handoff — 7 October 2026 / project email

Prepared by implementer; independent review and real owner onboarding pending.

## Pinned scope

- Base: `d19348d23e9b0cf5a2f5ac5d540a08fbce4b3485`.
- Code: `fd8060ade012dd146a79c6e1367584f209481746`.
- Deployment: existing `dental-notification.service` reads the updated source and
  root-only credential on each invocation; identity SMTP was configured locally.
- No anatomy, membership authority, OTP or email-verification bypass changes.

## Result

The owner could not complete email verification because identity SMTP was absent.
The owner supplied project mailbox passwords privately and authorized test sends.
`notifications@dentalopensource.org` now sends verification and application notices
through certificate-verified STARTTLS on `mail.dentalopensource.org:587`.
`contact@dentalopensource.org` is the contact/Reply-To mailbox. Owner notification
recipient is a separate trusted configuration field, never applicant-controlled.

The notification sender retains the historical Gmail configuration option, adds
only the exact project host/sender combination, rejects other hosts and plain
transport, and validates recipient/reply headers. No SMTP debug output or secrets
were placed in Git. Public signup and photo intake remain closed.

## Evidence

- DNS MX points to mail.dentalopensource.org; SMTP TLS587/465 certificates checked
  before authentication. Both project accounts authenticated over STARTTLS587.
- One authorized, clearly labelled test message per account was accepted by SMTP.
- Keycloak SMTP configuration updated, then a fresh owner verification email was
  accepted by its admin API. No emailVerified flag was changed. See the official
  [sendVerifyEmail API](https://www.keycloak.org/docs-api/latest/javadocs/org/keycloak/admin/client/resource/UserResource.html).
- Both mailboxes authenticated over certificate-verified IMAPS993; inboxes opened
  read-only. No message content copied to repo, logs or external AI services.
- Notification service Result=success / ExecMainStatus=0; timer active. A successful
  empty-queue invocation is not proof of delivery of a real membership notice.
- Seven targeted Python tests passed in a network-disabled, read-only-source,
  resource-limited container: separate project recipient/reply address, fixed
  template, header injection, host/transport restriction, TLS-before-auth, refused
  recipients and missing credentials. No production credentials in tests.
- [Code CI run](https://github.com/Madmin27/dental-knowledge-base/actions/runs/37654405336).
- SMTP acceptance is not inbox placement; owner delivery confirmation and actual
  completed password/MFA/verified login are pending at handoff preparation.

## Limits / operations

The application notification timer does not poll incoming mail. Continuous inbox
monitoring, automatic correspondence and anonymous-text-intake notifications are
not implemented. The two mailboxes are operationally accessible for authorized
maintenance; this is not a claim of unattended AI mail management.

Source .env is mode0600 and ignored by Git. Runtime copies are root-only private
JSON files and identity SMTP settings. Rotating .env alone does not rotate live
credentials. The existing encrypted snapshot allowlist omits these SMTP files;
keep private recovery copies separately. Never disable certificate validation to
work around delivery issues. Existing portal authentication requirements remain.

## Independent review questions

1. Can applicant input affect envelope/header fields or bypass TLS/host limits?
2. Does the separate sender/owner-recipient configuration preserve private routing?
3. Are delivery acceptance, inbox confirmation and human onboarding represented
   independently and truthfully in operation and documentation?
