const RAW_API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";
const RAW_MAILROOM_API_BASE =
  import.meta.env.VITE_MAILROOM_API_URL ?? "http://localhost:8083";

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

/** oneOps (helpdesk `/mail/...` and shared platform routes). */
export const API_BASE = normalizeOrigin(RAW_API_BASE);

export const API_V1 = `${API_BASE}/api/v1`;

/**
 * Mailroom mailbox API (`/mailbox/...`). Local extract defaults to :8083; production will move here
 * after cutover. Helpdesk stays on {@link API_V1} until a later split.
 */
export const MAILROOM_API_BASE = normalizeOrigin(RAW_MAILROOM_API_BASE);

export const MAILROOM_API_V1 = `${MAILROOM_API_BASE}/api/v1`;

export const IDENTITY_ISSUER = (import.meta.env.VITE_IDENTITY_ISSUER ?? "").replace(/\/+$/, "");

export const ONEOPS_URL = (import.meta.env.VITE_ONEOPS_URL ?? "").replace(/\/+$/, "");
