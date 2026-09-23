#!/bin/sh
set -eu
test "${CERTBOT_DOMAIN:-}" = dentalopensource.org
case "${CERTBOT_VALIDATION:-}" in ''|*[!A-Za-z0-9_-]*) exit 1;; esac
nsupdate -k /etc/bind/keys/dentalopensource-acme.key <<EOF
server 127.0.0.1
zone dentalopensource.org.
update delete _acme-challenge.dentalopensource.org. TXT "$CERTBOT_VALIDATION"
send
EOF
