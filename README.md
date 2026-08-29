# Prabhix Mailroom

Your own mailboxes, with folders. A mail client for the addresses Prabhix hosts, at
`mail.prabhixtechnologies.com` and on Android as `com.prabhix.mailroom`.

**Status: specification only.** No application code yet, deliberately — see [Why this is
empty](#why-this-is-empty).

---

## What it is, and what it is not

Mailroom is not a second version of OneOps' inbox. OneOps already has a complete **shared team
helpdesk**: threads, reply and forward, tags, canned replies, AI triage, SSE live updates, an Android
UI. Several people work one queue, and a message is a piece of work with an assignee and an SLA.

Mailroom is the other thing entirely — **one person's mail**. A message is correspondence, not a
ticket. That distinction matters commercially too, because OneOps is sold to customers and Mailroom is
what Prabhix staff read their own mail in.

The current platform model cannot express personal mail at all:

| Mailroom needs | Platform today |
| --- | --- |
| Personal mailboxes | `mail_mailboxes` is org-scoped and shared, with member grants |
| IMAP folders — INBOX, Sent, Drafts, Archive, Spam, Trash, plus custom | Thread *status*, not folders |
| Flags — seen, flagged, answered | No equivalent |
| Compose a new message | The console is reply-only |
| Persisted drafts | `mail_thread_drafts` exists in schema, with no REST API and no UI |
| Aliases | `mail_aliases` has no controller, so aliases are database-only |

So the first work is a `mailbox` API in the platform backend, not a client. Mail becomes its own
service after that contract settles — it is the natural second extraction after identity, at 22
tables with IMAP pollers, outbox workers and SES webhooks already cleanly packaged, but not
concurrently with identity.

## Authentication

Mailroom does not implement sign-in. It is an OIDC client of **Prabhix Identity**
(`../Identity`), which is also what makes one sign-in cover Mailroom, OneOps and MobiStack.

That is the whole reason this repository is later in the order than it looks like it should be: a
mail client is the first product with no legacy auth of its own, so it is the honest test of whether
Identity works as a general provider rather than as the platform's login endpoint wearing a hat.

## Transport

Postfix, Dovecot and Rspamd already run in `../Platform/mail-server`. Mailroom talks to the mailbox
API, not to IMAP directly — the API owns the IMAP session so that a phone on a train is not holding
one open.

Inbound on port 25 works. Outbound goes via SES, because AWS blocks outbound 25 from EC2; see
`../Platform/docs/MAIL.md`.

## Why this is empty

Scaffolding a client now would mean guessing at two things that are actively being decided:

1. **Identity is becoming a full OIDC provider** — authorization code flow with PKCE, a client
   registry, consent, per-client scopes — so that it can serve thousands of sites rather than three.
   Mailroom should be built against that surface, not against the interim one.
2. **The mailbox API does not exist yet.** A client written against an imagined contract gets
   rewritten when the real one lands.

The repository exists now so the name, the scope above, and the OIDC-client decision are recorded
rather than remembered.
