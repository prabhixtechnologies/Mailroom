# Mailroom backend (extraction)

Personal mailbox API extracted from oneOps (`/api/v1/mailbox`). Helpdesk
`/api/v1/mail/threads` remains in oneOps.

Local only: **port 8083**, no AWS.

## What works (Phase E)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/v1/mailbox` | Sidebar: mailboxes + folders + counts |
| GET | `/api/v1/mailbox/folders/{folderId}/threads` | Threads in a folder |
| GET | `/api/v1/mailbox/threads/{threadId}` | Single thread summary |
| GET | `/api/v1/mailbox/threads/{threadId}/messages` | Message bodies (new; web no longer needs helpdesk for this) |
| GET | `/api/v1/mailbox/starred` | Starred threads |
| GET | `/api/v1/mailbox/{mailboxId}/folders` | Folder list |

Writes (compose, flags, drafts, aliases, folder mutate) return **501** with a TODO until extracted.

Auth: Identity **RS256** via JWKS (same pattern as MobiStack / oneOps). Send
`Authorization: Bearer …` and `X-Prabhix-Org: <uuid>`.

## Local run

### 1. Database

Prefer a dedicated database:

```bash
createdb mailroom
# or: psql -c "CREATE DATABASE mailroom;"
```

Defaults in `application.yml`:

- URL: `jdbc:postgresql://localhost:5432/mailroom`
- User/password: `postgres` / `postgres`

Flyway applies `V1__mailbox_read_schema.sql` (schema `mail` + thin `users` /
`organization_memberships` mirrors).

**Optional — read existing oneOps mail data during extract:**

```bash
set DB_URL=jdbc:postgresql://localhost:5432/oneops
set FLYWAY_ENABLED=false
```

Do not run Mailroom Flyway against oneOps; the mail tables already live there under schema `mail`.

### 2. Identity

Identity must be reachable locally (default issuer `http://localhost:8081`).
JWKS is loaded from `{issuer}/.well-known/jwks.json`.

Optional: set `IDENTITY_SERVICE_TOKEN` + `IDENTITY_INTERNAL_URL` to mirror users via
`/internal/users/lookup`. If unset, Mailroom upserts `users` from JWT claims
(subject, email, name).

If `organization_memberships` is empty, any `X-Prabhix-Org` is accepted (local extract
escape hatch). Seed a membership row for stricter checks.

### 3. Build and start

```bash
cd Mailroom/backend
mvn -q -DskipTests package
mvn spring-boot:run
```

Health: `http://localhost:8083/actuator/health`

### 4. Web client

In `Mailroom/web/.env` (see `.env.example`):

```
VITE_API_URL=http://localhost:8080
VITE_MAILROOM_API_URL=http://localhost:8083
VITE_IDENTITY_ISSUER=http://localhost:8081
```

- Mailbox calls (`/api/v1/mailbox/...`) → Mailroom `:8083`
- Helpdesk calls (`/api/v1/mail/...`) → oneOps `:8080`

## Still in oneOps

- Helpdesk queue / threads API
- Inbound (LMTP/IMAP), outbound worker, SES webhooks
- Domain provisioning, DKIM
- Team-based mailbox grants (direct user membership only here for now)
