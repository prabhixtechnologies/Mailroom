const RAW_API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

/**
 * The API origin, without a trailing slash or version segment.
 *
 * <p>Normalised because two conventions exist in this codebase: the consoles pass an origin and the
 * Android clients pass a base that already includes `/api/v1`. Building with the wrong one produces
 * requests to `/api/v1/api/v1/...`, which do not fail as a wrong path — nothing matches, so the server
 * answers "Authentication is required" and the problem looks like a credentials problem.
 */
function normalizeOrigin(raw: string): string {
  return raw.replace(/\/+$/, "").replace(/\/api\/v1$/, "");
}

/**
 * The one API host. Personal mail (`/mailbox/...`) and the thread bodies it shares with the helpdesk
 * both live in the oneOps backend; a second origin for mail was a half-finished extraction that has
 * been removed, see `Infra/docs/PRODUCTS.md`.
 */
export const API_BASE = normalizeOrigin(RAW_API_BASE);

export const API_V1 = `${API_BASE}/api/v1`;

export const IDENTITY_ISSUER = (import.meta.env.VITE_IDENTITY_ISSUER ?? "").replace(/\/+$/, "");

export const ONEOPS_URL = (import.meta.env.VITE_ONEOPS_URL ?? "").replace(/\/+$/, "");

/** Identity's hosted account page: password, passkeys, sessions, connected accounts. */
export const ACCOUNT_URL = IDENTITY_ISSUER
  ? `${IDENTITY_ISSUER}/account?return_to=${encodeURIComponent(window.location.origin)}`
  : "";
