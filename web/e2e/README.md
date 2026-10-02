# Mailroom Playwright smoke tests

These specs stub `/api/v1/identity/auth/session/token`, `/api/v1/oneops/auth/me`, and `/api/v1/oneops/mailbox/*`, so they run without Identity or a backend.

```bash
cd web
npm install
npx playwright install chromium   # once per machine
npm run e2e
```

When Chromium is not installed, `npm run e2e:typecheck` still validates the specs. Set `E2E_SKIP_WEB_SERVER=1` if the dev server is already on port 5175.

Live checks against a seeded stack stay behind `E2E_LIVE=1` (not required for CI typecheck).
