# Mailroom backend (extraction)

The mailbox HTTP API and mail schema still live in **oneOps**
(`oneOps/backend/.../platform/mail`, ~135 Java files, Flyway V64+). Mailroom web/Android talk to
those endpoints today.

This directory is the target Spring Boot service. **Nothing here is deployed yet** — do not point
Caddy or clients at it until the cutover is approved.

## Why a separate service

STRATEGY: Mailroom is the mail product end to end. Keeping the mailbox API inside oneOps couples
personal mail to the operations console release train and widens the blast radius of a mail bug.

## Cutover plan (code first, deploy only with approval)

1. Stand up this module with Identity JWT verification (same dual-verify / RS256 pattern as
   MobiStack) and an empty `/actuator/health`.
2. Move packages in order: `mailbox` + `domain` DTOs used by it → `outbound`/`inbound` as needed →
   provisioning last. Shared platform types (`User`, org membership) become thin mirrors or internal
   HTTP calls — same idea as `IdentityUserMirror`.
3. Copy Flyway mail migrations into this service's schema history; stop applying them from oneOps.
4. Point Mailroom web/Android `VITE_*` / BuildConfig API base at the new service.
5. Leave helpdesk (`/mail/threads`…`) in oneOps until a later split — Mailroom README already notes
   it reuses those rows.

## Local skeleton

```bash
cd backend
# JDK 25+ when the platform standard applies; otherwise match oneOps.
mvn -q -DskipTests package
```

Until step 2 lands, this jar only proves the packaging pipeline.

## Blocked / approval gates

- AWS / host: new container, env secrets, Caddy route (e.g. `mail-api.prabhixtechnologies.com`)
- Data: RDS role + database `mail` (or dedicated schema) — see existing `mail` DB notes in Infra
- **Your approval before any production deploy or DNS change**
