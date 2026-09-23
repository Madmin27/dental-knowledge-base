# Contribution reliability and private backups

Verified 2026-09-23. This milestone improves the private intake. It does not
implement verified expert accounts, ballots, academic acceptance or publication.

## Live changes

- Unsent contribution forms survive closing/reopening the dialog in the same
  page. Language changes are blocked while drafts or unconfirmed receipts exist.
  Reload/exit uses the browser's unsaved-work warning; drafts are **not** durable
  after a browser crash and are not stored in localStorage.
- Follow-up comments use stable event IDs. Retrying a lost response cannot append
  the same comment twice; a revision conflict preserves the draft for resubmission.
- `/report` works without a 3D model. Technical reports explicitly carry no
  anatomical camera/source snapshot. Viewer startup failure also enables this form.
- Backend listens only on `127.0.0.1:3057`; HTTPS Nginx overwrites `X-Dental-Client`.
  Intake accepts that header only from the configured proxy. Shared networks still
  share an IP budget; this is a bounded pilot protection, not DDoS protection.
- Contributor history limits reserve room for moderator closure/redaction.
- Maintainers can archive closed records with the local CLI. Active capacity is
  2,000 records; total live plus archived capacity is 20,000. Archiving retains
  private tracking and makes the record read-only. Redaction still works.
- Authenticated list responses include capacity counts. `?archived=1` selects
  archived records. This is currently an operator API/CLI, not a reviewer desk.

## Same-host encrypted backup

User selected a private sibling of the web public directory:

`/root/projeler/DentalKnowledgeBase/apps/preview/private-backups/`

The directory is root-owned 0700, excluded from Git, and absent from the HTTP
asset allowlist. HTTPS access to `/private-backups/` returned 404. Snapshot files
are 0600 AES-256 GPG archives. The encryption key is separate:

`/root/.config/dental-backup/encryption.key`

Never commit or paste the key. Copy it to a private offline medium before relying
on these backups. Losing the key makes the archives unrecoverable. Same-machine
encryption does not protect against full root compromise or disk/server loss.
There is no second server/offsite backup at this stage.

`dental-backup.timer` runs daily at 03:20 server time with up to 15 minutes jitter.
It retains the newest **14 successful snapshots**, and only removes snapshots
with its own filename prefix. Each run decrypts and restores to a private temporary
directory before accepting the backup; temporary plaintext is removed afterward.
The initial live snapshot contained zero records. Nonempty restore/privacy cases
were verified separately with synthetic data.

Check `systemctl status dental-backup.timer dental-backup.service` and
`journalctl -u dental-backup.service`. A timer being enabled alone does not prove
that later runs succeed. Automated external failure notifications are not set up.

## Recovery and privacy

Decrypt into a private temporary directory, never a public path. Use
`scripts/restore_contributions.py ARCHIVE CURRENT_SPOOL NEW_DESTINATION`.
It refuses an existing destination, unsafe archive entries, mismatched hashes,
conflicting receipt identities, and oversized records. It reconciles the current
spool so newer comments and redaction tombstones survive restoring an old backup.

Stop intake before the final recovery/cutover and preserve both original state
and the most recent tombstones. Restore ownership to the service's StateDirectory
identity before restarting; do not copy arbitrary root-owned files into the live
spool while the service runs. A successful temporary restore is not a production
cutover. If current state/tombstones are lost, an old snapshot cannot know about
later privacy erasures. Do not publish restored records until reconciled.

Redaction removes live text but does not rewrite old encrypted backups. For an
immediate erasure request, the operator must take and verify a post-redaction
snapshot, then remove applicable earlier snapshots under the retention policy.
Never delete redaction tombstones merely to free active capacity; archive them.

## Evidence and next stages

- 77 Node tests and 12 Python tests passed.
- 7 existing contribution browser checks and 4 new draft/technical-report checks
  passed on an isolated localhost fixture; no real contributions were submitted.
- Nginx syntax passed; HTTPS health, report route, private-path denial and loopback
  listener were verified. Existing duplicate-vhost warnings for unrelated hosts
  were not altered by this change.
- Next: maintained OIDC/MFA identity service and individually scoped moderation
  desk under ADR0007. First administrator identity is still required from owner.
- Then: 3–5 real experts using the pilot pack. No invitations or academic approval
  have been issued. Operator tests are not evidence of anatomical correctness.
