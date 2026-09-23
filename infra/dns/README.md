# Dental Open Source authoritative DNS

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
