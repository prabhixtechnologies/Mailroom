# LMTP HTTP push (Postfix → platform backend)

Postfix `platform-push` transport calls `postfix-deliver.sh`, which:

1. POSTs signed JSON to `MAIL_LMTP_PUSH_URL` (default `http://backend:8080/api/v1/oneops/mail/inbound/lmtp`)
2. Delivers the same message to Dovecot over LMTP for Maildir/IMAP

Secrets are read from the environment only; scripts never log `MAIL_LMTP_TOKEN` or
`MAIL_LMTP_SIGNING_SECRET`.

Contract: `Infra/docs/MAIL.md` (headers and canonical HMAC string). Run `python verify_sign.py` after
any change.
