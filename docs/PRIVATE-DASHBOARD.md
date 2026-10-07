# Private dashboard and temporary Gmail setup

The manager-only dashboard is `/review/admin`. Both HTML and statistics API
require an enabled account, an active session, current manager appointment and
password/OTP authentication within 15 minutes. A hidden URL is not the protection.
Normal members and privacy reviewers without manager appointment cannot read it.
Responses use no-store; the browser clears counts on access failure, when the tab
is hidden and when its fresh-auth window expires. No statistics are cached in
localStorage. Management actions remain in the linked contribution workspace.

## What the numbers mean

- Enabled registered members, current unexpired roles and recent member sessions.
- Application status totals and age of the oldest pending application.
- Retained photo pipeline counts, declared file sizes and privacy-review queue.
  Deleted packages/photos are excluded; file sizes are not physical disk usage.
- 7/30/90-day daily applications and recorded privacy decisions, UTC dates.
- Approximate successful HTML responses for an allowlist of public atlas/project
  pages. Reloads, bots and operator checks count; these are **not unique visitors**.
  No request IP, user agent, referrer, query string, cookie, device/location or
  account identity enters the usage counters. Existing security controls/cookies
  elsewhere in the application are unrelated to this aggregate collector.

Counters start at deployment, with no invented historic traffic. Up to 90 UTC
calendar days are retained. Writes are batched for five seconds and heartbeat
updates occur every minute. Abrupt termination may lose a small unwritten batch;
this is an operational trend, not billing or tamper-proof analytics. A broken
snapshot is not replaced with zero counts. The UI marks stale heartbeat data and
uses unknown values for days after the last snapshot. The counters are not part
of the clinical backup or off-host disaster recovery.

Operational counts describe the private membership/photo pilot, not the older
anonymous text-contribution inbox. No personal application text or photo content
is returned by the statistics endpoint. Academic correctness is not measured.

## Server setup

Create a dedicated `dental-metrics` system group and `/var/lib/dental-metrics`
directory owned by root and that group, mode 2770. Install the two supplied
systemd drop-ins (`infra/review/metrics-preview.conf` and `metrics-review.conf`)
for dental-preview and dental-review respectively. The preview may write only
the aggregate directory; the portal gets a read-only view. Snapshot files use
0640. No private vault or application DB credential is shared with preview.
Restart both services after daemon-reload. There are no new public ports/routes
for raw counter storage. To disable collection, remove the preview drop-in and
restart it; the manager UI will mark any existing snapshot stale. Preserve or
remove that nonclinical aggregate file according to the owner's preference.

## Historical Gmail setup (superseded by remote SMTP on 7 October 2026)

Current project mail uses notifications/contact at dentalopensource.org; see
[mail deployment](APPLICATION-NOTIFICATIONS.md). The instructions below are
retained for the previous Gmail option, not the active setup.

The chosen mailbox is held only in `/etc/dental-review/mail-setup.json`, mode0600,
not in public source, HTML or GitHub. That private draft uses smtp.gmail.com,
port587/STARTTLS and the project display name. Using Gmail exposes its sender
address to mail recipients; a project display name does not hide the address.

The mailbox password must not be pasted into chat. For an eligible Google account,
enable two-step verification and create an app password; availability depends on
account policy. See [Google app-password instructions](https://support.google.com/mail/answer/185833?hl=en).
Enter the app password in the server terminal, without echo:

```sh
sudo python3 /root/projeler/DentalKnowledgeBase/infra/review/gmail-password.py /etc/dental-review/mail-setup.json
```

This only saves a private credential. It sends no message, does not claim email
ownership/delivery verification, and does not open registration. Do not use the
regular Google account password. Once the owner authorizes a concrete test
message and confirms delivery, record evidence and use the existing registration
activation procedure in [Membership portal](MEMBERSHIP-PORTAL.md).

The first owner bootstrap and durable application notifications are documented in
[Application notifications](APPLICATION-NOTIFICATIONS.md). The prepared identity
still requires password change, OTP setup and mailbox verification; an address
alone is not a verified login. Manager identity remains nonpublic. No scientific
or photo-review authority follows from the manager appointment.
