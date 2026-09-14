# Prabhix Mailroom

Your own mailboxes, with folders. A mail client for the addresses Prabhix hosts, at
`mail.prabhixtechnologies.com`.

**Status: web shipped; Android frozen in favour of the Flutter app in `../Mobile/apps/mailroom`.**

---

## What it is, and what it is not

Mailroom is not a second version of OneOps' inbox. OneOps has a complete **shared team helpdesk**:
threads, reply and forward, tags, canned replies, AI triage, SSE live updates — at `/inbox` in the
OneOps console. Several people work one queue, and a message there is a piece of work with an
assignee and an SLA clock.

Mailroom is the other thing entirely — **one person's mail**. A message is correspondence, not a
ticket. There is no assignee, no SLA, no queue. That distinction is commercial as well as conceptual:
OneOps is sold to customers, and Mailroom is what anyone with an address on a Prabhix-hosted domain
reads their own mail in.

The one organization-wide thing Mailroom does is **Company mail**: a member holding `MAIL_READ_ALL`
(organization OWNER, ADMIN and MANAGER by default) can switch from *My mail* to every mailbox the
organization owns, grouped by owner. Each cross-mailbox read is recorded. An ordinary member never
sees the switch. The boundary is written down in `../Infra/docs/PRODUCTS.md`, decision 1.

## Layout

```
web/         the browser client — Vite 8, React 19, Tailwind 4, served by nginx
android/     com.prabhix.mailroom — FROZEN; replaced by ../Mobile/apps/mailroom (Flutter)
mail-server/ Postfix, Dovecot, Rspamd transport
```

There is no backend here. Mailroom talks to the oneOps backend at `api.prabhixtechnologies.com`,
which owns the mail module (`/api/v1/mailbox` for personal mail). A partial extraction used to live in
`backend/`; it was deleted rather than left to drift, and can be redone on top of the shared
`identity-spring-boot-starter` when there is a reason to run mail as its own service.

The two are separate applications rather than one shared core, and they differ where a phone and a
desktop differ: the web client renders mail HTML behind DOMPurify and a content policy and autosaves
drafts; Android shows the plain-text alternative and has no draft of its own. `android/README.md` lists
what it deliberately leaves out and why.

## Authentication

Mailroom does not implement sign-in, and it has no password form. It is an OIDC client of **Prabhix
Identity** (`../Identity`), using the authorization code flow with PKCE (S256, mandatory) — as
`prabhix-mailroom` on the web and `prabhix-mailroom-android` on the phone. Two clients rather than one,
because a redirect registered for a browser must not be usable from an app and the other way round.

Signing in redirects to the hosted login page on Identity's origin. The session cookie set there is
what makes a sign-in on OneOps cover Mailroom without asking again — and it means a cross-site
scripting hole in Mailroom cannot steal a password, because Mailroom never receives one.

Being the first product with no legacy auth of its own, this is also the honest test of whether
Identity works as a general provider rather than as the platform's login endpoint wearing a hat.

## The API it talks to

One host: the oneOps backend (`VITE_API_URL`; `http://localhost:8080` locally,
`https://api.prabhixtechnologies.com` in production). Everything below is under `/api/v1`.

| Concern | Endpoint |
| --- | --- |
| Sidebar — mailboxes with folders and unread counts | `GET /mailbox` |
| Threads in a folder | `GET /mailbox/folders/{id}/threads` |
| Read, starred, snoozed | `PATCH /mailbox/threads/{id}/flags` |
| File into a folder | `POST /mailbox/folders/{id}/move` |
| Folders | `POST /mailbox/{mailboxId}/folders`, `PATCH` and `DELETE /mailbox/folders/{id}` |
| Drafts | `GET`, `PUT`, `DELETE /mailbox/drafts` |
| Send a new message | `POST /mailbox/compose` |
| Extra addresses | `GET`, `POST`, `DELETE /mailbox/{mailboxId}/aliases` |

| Company mail (holders of `MAIL_READ_ALL` only) | `GET /mailbox?scope=organization` |

Message bodies come from `GET /mailbox/threads/{id}/messages`, and replies from
`POST /mail/threads/{id}/reply`. Those are the same rows the helpdesk reads, and a second copy of
them would be one more place for the two to disagree.

Deleting a folder does not delete its mail: the threads move to the inbox. A reply to an archived
thread brings the thread back; a message to a thread in Spam leaves it there.

## Transport

Postfix, Dovecot and Rspamd live in `mail-server/` here. Mailroom talks to the mailbox API and never
to IMAP directly — the API owns the IMAP session, so a phone on a train is not holding one open.

Outbound goes via SES, because AWS blocks outbound 25 from EC2. Inbound for hosted domains is the open
decision in `../Infra/deploy/RUNBOOK-mail.md`: the MX still points at the registrar, so a hosted
address cannot yet receive internet mail. See `../Infra/docs/MAIL.md` for the design.

## Running it locally

```bash
cd web
cp .env.example .env
npm install
npm run dev          # http://localhost:5175
```

It needs the platform backend on `:8080` and Identity on `:8081`. With `VITE_IDENTITY_ISSUER` blank
the app says it is not configured rather than showing an empty screen, because there is no fallback
sign-in for it to offer.

Port 5175 is deliberate: the two consoles use 5173 and 5174, and running all three at once is the only
way to check locally that one sign-in covers them.

## Deployment

CI pushes `029096972251.dkr.ecr.ap-south-1.amazonaws.com/prabhix/mailroom` on every push to `main`.
Amazon ECR is the only registry; the workflow assumes an IAM role through GitHub's OIDC provider, so
there is no registry secret to configure. The Infra repository's compose stack runs that image as the
`mailroom` service and Caddy serves it at `mail.prabhixtechnologies.com`; `../Infra/deploy/deploy.sh`
pulls and restarts it alongside the consoles (`-MailroomTag <sha>` from `deploy-remote.ps1`).

`VITE_IDENTITY_ISSUER` is baked into the image at build time, so a change to it needs a rebuild rather
than a restart. The smoke checks assert the built bundle contains an authorize URL, which is what
catches an image built without it.
