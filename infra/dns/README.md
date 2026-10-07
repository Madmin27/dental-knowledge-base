# Dental Open Source DNS and certificate renewal

## Current deployment — 7 October 2026

The public parent zone is hosted at `ns1.megapanel.org` / `ns2.megapanel.org`.
Web traffic still targets this server (`85.96.191.197`). Mailbox provisioning
and application SMTP are separate operations; a DNS migration does not enable
application email delivery.

The remote DNS panel delegates only certificate validation:

```
_acme-challenge.dentalopensource.org. 300 IN NS ns1-acme.minen.com.tr.
```

Do not add a CNAME at that same owner. The existing ACME nameserver resolves to
`85.96.191.197`; existing public TCP/UDP 53 routing is required. Public TCP 80
is not required for this DNS-01 renewal route.

Local BIND serves the child zone using `named.conf.dental-acme`; its dynamic
file lives at `/var/lib/bind/acme-challenge-dental/`. The TSIG key remains outside
Git in `/etc/bind/keys/dentalopensource-acme.key`. It is currently defined by the
older `named.conf.dentalopensource` include. If retiring that local parent zone,
preserve exactly one key include before the child zone; never copy the key here.
The hook scripts now update the child zone, with permission for its exact TXT
owner only. Seed zone files must not overwrite a journaled live zone.

Verify delegation and renewal after any DNS move:

```sh
dig @1.1.1.1 _acme-challenge.dentalopensource.org NS +short
certbot renew --cert-name dentalopensource.org --dry-run --run-deploy-hooks --no-random-sleep-on-renew
```

The 7 October 2026 dry run succeeded, including the deploy hook.
A successful dry run tests staging issuance and the Nginx deploy hook; it does
not replace the current production certificate. Keep normal `certbot.timer`
enabled. A single ACME nameserver is not redundant.

## Historical installation notes (23 September 2026)


## DNS-01 certificate automation (2026-09-23)

The live zone now resides in
`/var/lib/bind/dentalopensource/db.dentalopensource.org` (bind-owned, journaled).
The repository zone is an initial seed: do not overwrite the live dynamic zone
with it. Synchronize/freeze via rndc before any manual future zone edits.
The TSIG key under `/etc/bind/keys/dentalopensource-acme.key` is secret, outside
Git, root:bind mode0640; its only permission is the exact ACME TXT owner name.
All other dynamic updates and zone transfers remain denied.

`certbot-dental-auth.sh`, `certbot-dental-cleanup.sh` and
`certbot-dental-deploy.sh` are installed under `/usr/local/sbin/` and referenced
by Certbot renewal configuration. DNS-01 certificate issuance succeeded;
DNS delegation is now active. External HTTP/HTTPS routing is a separate check.

The initial-install notes below precede certificate automation.

Installed on 2026-09-23: `named.conf.dentalopensource` and
`db.dentalopensource.org` under `/etc/bind`, included by `named.conf.local`.
The previous local configuration is backed up at
`/etc/bind/named.conf.local.before-dental-20260923`.

Registrar steps (performed by the domain owner):

1. Register child nameserver/glue `ns1.dentalopensource.org` with IPv4
   `85.96.191.197`.
2. Set the domain's authoritative nameserver to `ns1.dentalopensource.org`.
   Glue registration alone does not change delegation.
3. If the registrar requires another nameserver, arrange a real independent
   secondary; no `ns2` or redundancy has been provisioned here.

The zone publishes apex and ns1 A records, plus www CNAME. The www DNS alias
does not yet have a matching TLS/Nginx site. No mail service is configured.
Increase the SOA serial on each future zone update.

Local UDP/TCP authoritative responses passed; the existing ACME zone still
answers. Recursion remains disabled, and zone transfer/update is denied for
the new zone. UFW already allows TCP and UDP 53; firewall changes were not needed.

Queries from the server to its own WAN IP timed out. This does not distinguish
missing NAT forwarding from hairpin limitations. From a different network run:

```sh
dig @85.96.191.197 dentalopensource.org A +norecurse
dig @85.96.191.197 dentalopensource.org NS +tcp +norecurse
```

Both must return authoritative answers. If they do not, verify modem forwarding
of **TCP and UDP 53 → 192.168.1.192:53**. HTTP access to minen.com.tr does not
prove DNS port reachability. Public delegation and HTTPS are still pending.

After delegation resolves publicly, complete `docs/PUBLIC-PILOT-DEPLOYMENT.md`.
