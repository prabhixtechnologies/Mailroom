# Prabhix Mailroom

Your own mailboxes, with folders. A mail client for the addresses Prabhix hosts, at
`mail.prabhixtechnologies.com`.

**Status: web and Android shipped.**

---

## What it is, and what it is not

Mailroom is not a second version of OneOps' inbox. OneOps has a complete **shared team helpdesk**:
threads, reply and forward, tags, canned replies, AI triage, SSE live updates, an Android UI. Several
people work one queue, and a message there is a piece of work with an assignee and an SLA clock.

Mailroom is the other thing entirely — **one person's mail**. A message is correspondence, not a
ticket. There is no assignee, no SLA, no queue. That distinction is commercial as well as conceptual:
OneOps is sold to customers, and Mailroom is what anyone with an address on a Prabhix-hosted domain
reads their own mail in.

## Layout

```
web/         the browser client — Vite, React 19, Tailwind 4, served by nginx
android/     com.prabhix.mailroom — one module, one flavor, Compose
```

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

`/api/v1/mailbox` in the platform backend, added by migration V64:

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

Message bodies come from the helpdesk's `GET /mail/threads/{id}`, and replies from
`POST /mail/threads/{id}/reply`. Those are the same rows either way, and a second endpoint returning
them would be one more place for the two to disagree.

Deleting a folder does not delete its mail: the threads move to the inbox. A reply to an archived
thread brings the thread back; a message to a thread in Spam leaves it there.

## Transport

Postfix, Dovecot and Rspamd run in `../Platform/mail-server`. Mailroom talks to the mailbox API and
never to IMAP directly — the API owns the IMAP session, so a phone on a train is not holding one open.

Inbound on port 25 works. Outbound goes via SES, because AWS blocks outbound 25 from EC2; see
`../Platform/docs/MAIL.md`.

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

CI pushes `029096972251.dkr.ecr.ap-south-1.amazonaws.com/prabhix/prabhix-mailroom` on every push to
`main`, and uploads a debug APK as a build artifact. Amazon ECR is the only registry; the workflow
assumes an IAM role through GitHub's OIDC provider, so there is no registry secret to configure. The Platform repo's compose stack runs that image as the `mailroom` service and Caddy
serves it at `mail.prabhixtechnologies.com`; `../Platform/deploy/deploy.sh` pulls and restarts it
alongside the consoles.

`VITE_IDENTITY_ISSUER` is baked into the image at build time, so a change to it needs a rebuild rather
than a restart. The smoke checks assert the built bundle contains an authorize URL, which is what
catches an image built without it.
