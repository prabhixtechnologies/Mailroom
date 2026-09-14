import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ApiClientError, apiRequest, configureApiClient } from "./api-client";
import { beginLogout } from "@prabhix/oidc-client";
import "./oidc-config";

/**
 * Who is signed in, and the access token to prove it.
 *
 * <p>Mailroom stores nothing durable. The access token lives in memory only — a page reload throws it
 * away and the session cookie set by Identity is exchanged for a new one, which is the same shape the
 * consoles use. Nothing goes in localStorage: it is readable by injected script, and it is scoped to one
 * origin, so it could not carry a session across three hostnames even if that were safe.
 */
const SESSION_TOKEN_PATH = "/auth/session/token";

const authTokensSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().optional(),
});

const authMeSchema = z.object({
  userId: z.string(),
  organizationId: z.string(),
  email: z.string().optional(),
  displayName: z.string().nullable().optional(),
  permissions: z.array(z.string()).default([]),
});

export type AuthMe = z.infer<typeof authMeSchema>;

interface AuthContextValue {
  accessToken: string | null;
  me: AuthMe | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginWithTokens: (accessToken: string, idToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  permissions: string[];
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [me, setMe] = useState<AuthMe | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // The token lives in a ref as well as state. The ref is what the callbacks read; the state exists only
  // so the tree re-renders. Reading it from state inside a callback would change that callback's
  // identity on every renewal, and one of them is a dependency of the bootstrap effect.
  const accessTokenRef = useRef<string | null>(null);
  const orgIdRef = useRef<string | null>(null);
  const idTokenRef = useRef<string | undefined>(undefined);

  // Set once the server has said there is no session for this browser. Without it, every query that
  // 401s starts its own exchange: the single-flight guard below only collapses concurrent attempts, so
  // a page with several queries walks through them one at a time and earns a rate limit.
  //
  // Only set on a refusal. A network error is temporary, and treating it as "signed out" would strand a
  // signed-in person on the sign-in screen until they reloaded.
  const sessionGone = useRef(false);

  const setAccessToken = useCallback((token: string | null) => {
    accessTokenRef.current = token;
    setAccessTokenState(token);
    if (token) sessionGone.current = false;
  }, []);

  const loadSession = useCallback(async () => {
    const authMe = await apiRequest("/auth/me", authMeSchema);
    // Set before anything else fetches, so the first mailbox request already carries the org header.
    orgIdRef.current = authMe.organizationId;
    setMe(authMe);
    return authMe;
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setMe(null);
    orgIdRef.current = null;
    queryClient.clear();
  }, [queryClient, setAccessToken]);

  const refreshInFlight = useRef<Promise<boolean> | null>(null);

  // Deliberately does not reload the session. Doing that inside the single-flight promise meant a 401
  // from /auth/me would ask for a refresh, be handed back the very promise waiting on it, and deadlock.
  const refreshSession = useCallback(async (): Promise<boolean> => {
    const existing = refreshInFlight.current;
    if (existing) return existing;
    if (sessionGone.current) return false;

    const attempt = (async () => {
      try {
        const tokens = await apiRequest(SESSION_TOKEN_PATH, authTokensSchema, {
          method: "POST",
          // skipAuth matters beyond tidiness: it stops a 401 here from triggering the client's own
          // refresh-and-retry, which would call straight back into this function.
          skipAuth: true,
          skipOrg: true,
        });
        setAccessToken(tokens.accessToken);
        return true;
      } catch (err) {
        if (err instanceof ApiClientError && (err.status === 401 || err.status === 403)) {
          sessionGone.current = true;
        }
        return false;
      } finally {
        refreshInFlight.current = null;
      }
    })();

    refreshInFlight.current = attempt;
    return attempt;
  }, [setAccessToken]);

  const loginWithTokens = useCallback(
    async (access: string, idToken?: string) => {
      idTokenRef.current = idToken;
      setAccessToken(access);
      await loadSession();
    },
    [loadSession, setAccessToken],
  );

  const logout = useCallback(async () => {
    const idToken = idTokenRef.current;
    try {
      if (accessTokenRef.current) {
        // Clears the shared cookie, so the consoles are signed out too — one session, one sign-out.
        await apiRequest("/auth/logout", { parse: () => undefined }, { method: "POST" });
      }
    } catch {
      // A failed logout call must not stop the local teardown.
    }
    sessionGone.current = true;
    clearSession();
    // Then the provider, which is what actually ends the session. Skipping this leaves the identity
    // cookie in place and the next /authorize signs the person straight back in.
    beginLogout(idToken);
  }, [clearSession]);

  useEffect(() => {
    configureApiClient({
      getAccessToken: () => accessTokenRef.current,
      getOrgId: () => orgIdRef.current,
      refreshTokens: refreshSession,
      // Local teardown only. Calling the logout endpoint here would POST the very access token the
      // server just refused.
      onUnauthorized: clearSession,
    });
  }, [refreshSession, clearSession]);

  const didBootstrap = useRef(false);

  useEffect(() => {
    if (didBootstrap.current) return;
    didBootstrap.current = true;
    void (async () => {
      setIsLoading(true);
      try {
        // Attempted unconditionally: this one request is what makes a sign-in on OneOps cover Mailroom.
        // Somebody who is not signed in pays a single 401 for it.
        if (!(await refreshSession())) {
          clearSession();
          return;
        }
        try {
          await loadSession();
        } catch {
          clearSession();
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, [refreshSession, loadSession, clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      me,
      isLoading,
      isAuthenticated: !!me && !!accessToken,
      loginWithTokens,
      logout,
      permissions: me?.permissions ?? [],
    }),
    [accessToken, me, isLoading, loginWithTokens, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
