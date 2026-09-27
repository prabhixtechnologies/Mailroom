#!/bin/sh
# POST one message to the platform LMTP ingest endpoint with signed headers.
# Never log MAIL_LMTP_TOKEN or MAIL_LMTP_SIGNING_SECRET.
set -eu

recipient="${1:?recipient}"
mime_file="${2:?mime file}"

push_url="${MAIL_LMTP_PUSH_URL:-http://backend:8080/api/v1/oneops/mail/inbound/lmtp}"
token="${MAIL_LMTP_TOKEN:-}"
signing_secret="${MAIL_LMTP_SIGNING_SECRET:-}"

if [ -z "$token" ]; then
  echo "lmtp-push: MAIL_LMTP_TOKEN is not set" >&2
  exit 67
fi

if [ ! -s "$mime_file" ]; then
  echo "lmtp-push: empty message for ${recipient}" >&2
  exit 67
fi

signing_key="$token"
if [ -n "$signing_secret" ]; then
  signing_key="$signing_secret"
fi

raw_b64=$(base64 -w 0 <"$mime_file" 2>/dev/null || base64 <"$mime_file" | tr -d '\n')
timestamp=$(date +%s)
nonce=$(od -An -N16 -tx1 /dev/urandom 2>/dev/null | tr -d ' \n')
if [ -z "$nonce" ]; then
  nonce=$(date +%s%N)
fi

signature=$(printf '%s\n%s\n%s\n%s' "$timestamp" "$nonce" "$recipient" "$raw_b64" | \
  openssl dgst -sha256 -hmac "$signing_key" -hex | awk '{print $2}')

safe_recipient=$(printf '%s' "$recipient" | sed 's/\\/\\\\/g; s/"/\\"/g')
body="{\"recipient\":\"${safe_recipient}\",\"rawMimeBase64\":\"${raw_b64}\"}"

http_code=$(curl -sS -o /tmp/lmtp-push-response.$$ -w '%{http_code}' \
  -X POST "$push_url" \
  -H "Content-Type: application/json" \
  -H "X-Mail-Token: ${token}" \
  -H "X-Mail-Timestamp: ${timestamp}" \
  -H "X-Mail-Nonce: ${nonce}" \
  -H "X-Mail-Signature: ${signature}" \
  --data-binary "$body" || echo "000")

rm -f /tmp/lmtp-push-response.$$

case "$http_code" in
  202|200) exit 0 ;;
  4*) echo "lmtp-push: permanent failure HTTP ${http_code} for ${recipient}" >&2; exit 67 ;;
  *) echo "lmtp-push: temporary failure HTTP ${http_code} for ${recipient}" >&2; exit 75 ;;
esac
