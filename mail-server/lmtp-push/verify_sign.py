#!/usr/bin/env python3
"""LMTP HTTP push signing — shared contract with oneOps LmtpIngestController.

Canonical payload (UTF-8, newline-separated):

    {timestamp}\\n{nonce}\\n{recipient}\\n{rawMimeBase64}

HMAC-SHA256 with key = MAIL_LMTP_SIGNING_SECRET if set, else MAIL_LMTP_TOKEN.
Signature is lowercase hex in X-Mail-Signature.

Run self-test:

    python verify_sign.py
"""
from __future__ import annotations

import hashlib
import hmac
import shutil
import subprocess
import sys


def signing_key(token: str, signing_secret: str | None) -> str:
    if signing_secret and signing_secret.strip():
        return signing_secret.strip()
    return token


def canonical(timestamp: str, nonce: str, recipient: str, raw_mime_b64: str) -> bytes:
    return f"{timestamp}\n{nonce}\n{recipient}\n{raw_mime_b64}".encode("utf-8")


def compute_signature(
    key: str,
    timestamp: str,
    nonce: str,
    recipient: str,
    raw_mime_b64: str,
) -> str:
    return hmac.new(key.encode("utf-8"), canonical(timestamp, nonce, recipient, raw_mime_b64), hashlib.sha256).hexdigest()


def main() -> int:
    token = "test-token-only"
    secret = "test-signing-secret"
    ts = "1700000000"
    nonce = "abc123nonce"
    recipient = "support@prabhixtechnologies.com"
    raw_b64 = "dGVzdA=="
    expected = compute_signature(secret, ts, nonce, recipient, raw_b64)
    again = compute_signature(signing_key(token, secret), ts, nonce, recipient, raw_b64)
    if expected != again:
        print("signing_key fallback mismatch", file=sys.stderr)
        return 1
    token_sig = compute_signature(signing_key(token, ""), ts, nonce, recipient, raw_b64)
    if token_sig == expected:
        print("token-only signature must differ when signing secret is set", file=sys.stderr)
        return 1

    if shutil.which("openssl"):
        payload = canonical(ts, nonce, recipient, raw_b64)
        proc = subprocess.run(
            ["openssl", "dgst", "-sha256", "-hmac", secret, "-hex"],
            input=payload,
            capture_output=True,
            check=True,
        )
        openssl_hex = proc.stdout.decode().strip().split()[-1]
        if openssl_hex.lower() != expected:
            print("openssl signature mismatch", file=sys.stderr)
            return 1

    print("verify_sign: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
