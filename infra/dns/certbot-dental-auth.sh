#!/bin/sh
set -eu
test "${CERTBOT_DOMAIN:-}" = dentalopensource.org
case "${CERTBOT_VALIDATION:-}" in ''|*[!A-Za-z0-9_-]*) exit 1;; esac
nsupdate -k /etc/bind/keys/dentalopensource-acme.key <<EOF
server 127.0.0.1
zone dentalopensource.org.
update add _acme-challenge.dentalopensource.org. 30 TXT "$CERTBOT_VALIDATION"
send
EOF
sleep 45
