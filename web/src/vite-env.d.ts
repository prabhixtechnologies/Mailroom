/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the oneOps API, without a version segment. The only API host Mailroom talks to. */
  readonly VITE_API_URL?: string;
  /**
   * Issuer origin of Prabhix Identity. Blank means OIDC is not configured, and Mailroom refuses to
   * pretend it can sign anybody in — it has no password form to fall back to.
   */
  readonly VITE_IDENTITY_ISSUER?: string;
  /** Where "back to OneOps" goes, for somebody who arrived here from the console. */
  readonly VITE_ONEOPS_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
