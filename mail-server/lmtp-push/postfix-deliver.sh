#!/bin/sh
# Postfix pipe transport: push to platform HTTP ingest, then deliver to Dovecot LMTP.
set -eu

recipient="${1:?recipient}"
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT INT TERM

cat >"$tmp"

/opt/lmtp-push/http-push.sh "$recipient" "$tmp"

/usr/libexec/postfix/lmtp -n dovecot-lmtp -G -i -- "$recipient" <"$tmp"
