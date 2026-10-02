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
which owns the mail module (`/api/v1/oneops/mailbox` for personal mail). A partial extraction used to live in
`backend/`; it was deleted rather than left to drift, and can be redone on top of the shared
`identity-spring-boot-starter` when there is a reason to run mail as its own service.

The web client and the Flutter app in `../Mobile/apps/mailroom` both talk to the same query-parameter
mailbox API. The web client renders mail HTML behind DOMPurify and a rich-text editor. The phone
shows HTML mail, saves drafts, and sends plain-text compose and replies with attachments. The frozen
`android/` tree is not the shipping client. `android/README.md` lists what that old tree left out.

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
`https://api.prabhixtechnologies.com` in production). Mailroom calls the **mailbox module** under
`/api/v1/oneops/mailbox` (not the legacy `/mailbox` paths in older notes).

| Concern | Endpoint |
| --- | --- |
| Sidebar — mailboxes with folders and unread counts | `GET /oneops/mailbox` (add `?mode=company` for Company mail) |
| Threads in a folder (cursor pages) | `GET /oneops/mailbox/folders/threads/page?folderId=&limit=&cursor=&q=&unreadOnly=&hasAttachment=` |
| Starred / snoozed virtual lists | `GET /oneops/mailbox/starred`, `GET /oneops/mailbox/snoozed` |
| Message bodies | `GET /oneops/mailbox/threads/messages?threadId=` |
| Read, starred, snooze | `PATCH /oneops/mailbox/threads/flags?threadId=` (JSON body) |
| Bulk flags | `POST /oneops/mailbox/threads/flags` |
| File into a folder | `POST /oneops/mailbox/folders/move?folderId=` |
| Folders | `POST /oneops/mailbox/folders?mailboxId=`, `PATCH` / `DELETE ?folderId=` |
| Drafts | `GET`, `PUT`, `DELETE /oneops/mailbox/drafts` |
| Send a new message | `POST /oneops/mailbox/compose` |
| Reply / forward | `POST /oneops/mail/threads/reply?id=` |
| Attachments | `POST /oneops/mailbox/attachments`, `GET …/attachments/pending?fileId=`, `GET …/attachments?messageId=` |
| Live updates | `GET /oneops/mail/stream` (SSE over fetch) |
| Extra addresses | `GET`, `POST`, `DELETE /oneops/mailbox/aliases?mailboxId=` |

Replies use the shared helpdesk outbox path above; message rows are the same ones OneOps reads at
`/inbox`, so there is not a second copy of the thread store.

### Modern web client (Mailroom `web/`)

- **Cursor-paginated folder lists** with search, unread-only, and attachment filters; infinite scroll
  and “Load more”.
- **Starred**, **Snoozed**, and **Drafts** views; **Company mail** when `MAIL_READ_ALL` is granted.
- **Bulk actions** (read/unread, star, archive, spam, trash, move, snooze / unsnooze).
- **Compose** with recipient validation, rich-text (TipTap, code-split), drag-and-drop attachments,
  autosaved drafts, and inline reply / forward on the reading desk.
- **Sanitised HTML** rendering (DOMPurify + isolated iframe for message CSS); remote images blocked
  until explicitly loaded.
- **Keyboard shortcuts** (`?` for the list); responsive list/desk layout.
- **Deep links** — the location bar stays in sync (OneOps can link to Mailroom with the same query
  names):

| Query | Meaning |
| --- | --- |
| `mode=company` | Company mail sidebar (requires permission) |
| `view=starred` / `view=snoozed` | Virtual lists |
| `mailbox=<id>` | Active mailbox (Company mail) |
| `folder=<id>` | Folder threads |
| `thread=<id>` | Open conversation |
| `compose=1` | Open compose |
| `draft=<id>` | Open a saved draft |
| `q=` | Search (folder view uses server-side debounced query) |
| `unread=1` | Unread-only filter |
| `attachments=1` | Has-attachment filter |
| `desk=busy` | Non-production layout stress preview (`VITE_ENVIRONMENT` ≠ `PRODUCTION`) |

Example from the OneOps console (set `VITE_MAILROOM_URL` in OneOps web):

`https://mail.prabhixtechnologies.com/?folder=<folderId>&thread=<threadId>`

Deleting a folder does not delete its mail: the threads move to the inbox. A reply to an archived
thread brings the thread back; a message to a thread in Spam leaves it there.

## Transport

Postfix, Dovecot and Rspamd live in `mail-server/` here. Mailroom talks to the mailbox API and never
to IMAP directly — the API owns the IMAP session, so a phone on a train is not holding one open.

Outbound goes via SES, because AWS blocks outbound 25 from EC2. Inbound for hosted domains is
decided in `../Infra/deploy/RUNBOOK-mail.md`: SES receiving in ap-south-1 is the intended path
once ingest is wired; MX still points at GoDaddy until then. See `../Infra/docs/MAIL.md` for the
design.

## Running it locally

```bash
cd web
cp .env.example .env
npm install
npm run dev          # http://localhost:5175
npm test             # unit + integration (Vitest)
npm run e2e:typecheck
npm run e2e          # Playwright smoke tests (stubbed API; see web/e2e/README.md)
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
