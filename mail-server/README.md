# Prabhix Mail Server — Layer 1 Transport Runbook

Self-hosted **Postfix + Dovecot + Rspamd** for organizations using `SELF_HOSTED` mode.
Most deployments should stay on **`EXTERNAL_IMAP`** (Google Workspace, Zoho) until you have
ops bandwidth for deliverability, DNS, and abuse handling.

## When to use this vs EXTERNAL_IMAP

| Use self-hosted (`--profile mailserver`) | Prefer EXTERNAL_IMAP |
|---|---|
| You need full control of MX and per-tenant domains | You want Google/Zoho to handle deliverability |
| Compliance requires mail data on your EC2 | You cannot maintain PTR, SPF, DKIM, DMARC weekly |
| You have someone on-call for blocklists | AWS port 25 is blocked and relay is unacceptable |

**Honest assessment:** self-hosting mail is a part-time job. Blocklists, IP reputation,
bounce handling, and TLS certificate rotation will page you. The platform's shared inbox
works identically with IMAP pull — only latency and cost profile change.

---

## Quick start

```bash
# Base stack must be up (provides Postgres on network "prabhix")
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d postgres

# Mail transport (opt-in profile)
docker compose -f docker-compose.yml \
  -f mail-server/docker-compose.mail.yml \
  --profile mailserver up -d
```

Set backend env for outbound via your Postfix:

```env
MAIL_TRANSPORT=SELF_HOSTED_SMTP
SMTP_HOST=postfix
SMTP_PORT=587
SMTP_AUTH=true
SMTP_USERNAME=...
SMTP_PASSWORD=...
SMTP_STARTTLS=true
MAIL_LMTP_TOKEN=<shared-secret-for-inbound-push>
```

---

## AWS EC2 port 25 unblock

AWS **blocks outbound SMTP on port 25** by default on EC2. Inbound :25 usually works,
but you cannot deliver directly to the internet until unblocked.

1. Submit the [AWS Request to Remove Email Sending Limitations](https://aws.amazon.com/forms/ec2-email-limit-rds-request).
2. Explain legitimate transactional + helpdesk mail, include your domain and Elastic IP.
3. Approval can take 24–48 hours (sometimes denied for new accounts).

**Until approved:** set `MAIL_RELAY_HOST` in `deploy/.env.prod` or compose env:

```env
MAIL_RELAY_HOST=[email-smtp.ap-south-1.amazonaws.com]:587
MAIL_RELAY_USER=AKIA...
MAIL_RELAY_PASSWORD=...
```

Postfix relays outbound through the smarthost while you still receive inbound on :25.

---

## PTR / reverse DNS

Your Elastic IP **must** reverse-resolve to `mail.prabhixtechnologies.com` (or whatever
`MAIL_HOSTNAME` is). Mismatch is the #1 cause of Gmail rejecting mail.

In AWS EC2 → Elastic IPs → select IP → **Reverse DNS** → set to your mail hostname.
Forward DNS must agree:

```
mail.prabhixtechnologies.com.  IN  A  <elastic-ip>
```

Verify:

```bash
dig +short mail.prabhixtechnologies.com A
dig +short -x <elastic-ip> PTR
```

---

## DNS records — example for `prabhixtechnologies.com`

Replace `<ELASTIC_IP>` and DKIM key with values from **GET /api/v1/mail/domains/{id}/dns**.

| Type | Name | Value |
|---|---|---|
| A | `mail` | `<ELASTIC_IP>` |
| MX | `@` | `10 mail.prabhixtechnologies.com.` |
| TXT | `@` | `v=spf1 mx a:mail.prabhixtechnologies.com -all` |
| TXT | `pbx1._domainkey` | `v=DKIM1; k=rsa; p=<base64-public-key>` |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@prabhixtechnologies.com; pct=100` |
| TXT | `_mta-sts` | `v=STSv1; id=2025082701` |
| CNAME | `mta-sts` | points to hosting for `/.well-known/mta-sts.txt` |
| TXT | `_smtp._tls` | `v=TLSRPTv1; rua=mailto:tlsrpt@prabhixtechnologies.com` |

**MTA-STS policy file** at `https://mta-sts.prabhixtechnologies.com/.well-known/mta-sts.txt`:

```
version: STSv1
mode: enforce
mx: mail.prabhixtechnologies.com
max_age: 86400
```

---

## Testing

### swaks (CLI)

```bash
# Inbound delivery test
swaks --to support@prabhixtechnologies.com \
  --from sender@example.com \
  --server mail.prabhixtechnologies.com:25

# Authenticated submission
swaks --to recipient@gmail.com \
  --from support@prabhixtechnologies.com \
  --server mail.prabhixtechnologies.com:587 \
  --auth LOGIN --auth-user support@prabhixtechnologies.com --auth-password '...'
```

### mail-tester.com

Send one message to the address mail-tester gives you. Aim for **9+/10** before production.
Fix SPF, DKIM, DMARC, and PTR failures first — Rspamd score is secondary.

### IMAP

```bash
openssl s_client -connect mail.prabhixtechnologies.com:993
# a1 LOGIN support@prabhixtechnologies.com password
```

---

## Reading Postfix logs

Logs go to stdout in Docker:

```bash
docker compose -f mail-server/docker-compose.mail.yml --profile mailserver logs -f postfix
```

| Log fragment | Meaning |
|---|---|
| `status=sent (delivered via dovecot-lmtp)` | Inbound accepted and stored |
| `relay=... dsn=5.` | Permanent bounce — check recipient map / DNS |
| `reject: 550 5.1.1` | Unknown recipient — mailbox not in `mail_mailboxes` |
| `milter-reject` | Rspamd blocked — check `rspamd` logs |
| `connect from unknown[...]` | Normal; greylisting may defer first attempt |

Dovecot delivery issues:

```bash
docker compose -f mail-server/docker-compose.mail.yml --profile mailserver logs -f dovecot
```

Rspamd:

```bash
docker compose -f mail-server/docker-compose.mail.yml --profile mailserver logs -f rspamd
```

---

## Postgres recipient lookups

Postfix reads live data — no reload needed when mailboxes are provisioned:

- **Domains:** `mail_domains` where `mode = 'SELF_HOSTED'`
- **Mailboxes:** `mail_mailboxes.address` where `status = 'ACTIVE'`
- **Aliases:** `mail_aliases.address` → canonical mailbox

See `postfix/pgsql-*.cf` for exact SQL against `V5__mail_core.sql`.

---

## DKIM key rotation

1. Platform provisioning generates new key pair, updates `mail_domains.dkim_selector`.
2. Sync private key to `/var/lib/rspamd/dkim/<domain>.<selector>.key` on the rspamd volume.
3. Update `rspamd/local.d/dkim_selectors.map`.
4. Publish new TXT at `<selector>._domainkey`.
5. After DNS TTL, retire old selector.

---

## Bootstrap IMAP passwords

Dovecot cannot decrypt `imap_password_enc`. For initial access, edit
`dovecot/bootstrap.passwd` (BLF-CRYPT hashes) and restart Dovecot.
Long-term: provisioning must write bcrypt hashes and switch `10-auth.conf` to SQL passdb.

---

## Firewall (production EC2)

When using `--profile mailserver`, open **25, 587, 993** in UFW (see `deploy/ec2-bootstrap.sh`).
Without the profile, leave mail ports closed.

---

## Related docs

- [docs/MAIL.md](../docs/MAIL.md) — full three-layer design
- [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) — §6 Email subsystem
- [deploy/RUNBOOK.md](../deploy/RUNBOOK.md) — production deploy and mail troubleshooting
