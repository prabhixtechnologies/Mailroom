import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { LogoMark } from "@/components/LogoMark";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { useAuth } from "@/lib/auth";
import { beginLogin, completeLogin, rememberIdToken } from "@/lib/oidc";
import { safeAppPath } from "@/lib/safePath";

/** Where Identity sends the browser back to, carrying the authorization code. */
export function CallbackPage() {
  const [searchParams] = useSearchParams();
  const { loginWithTokens } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);

  // React runs effects twice in development. The code is single-use, so a second exchange fails and
  // would show an error on a sign-in that actually worked.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      try {
        const { tokens, returnTo } = await completeLogin(searchParams);
        // Before loadSession: a slow /auth/me must not leave a signed-in tab with no id token for logout.
        rememberIdToken(tokens.idToken);
        await loginWithTokens(tokens.accessToken, tokens.idToken);
        navigate(safeAppPath(returnTo), { replace: true });
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Sign-in did not complete.");
      }
    })();
  }, [searchParams, loginWithTokens, navigate]);

  if (message) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-8 text-center">
        <LogoMark className="mx-auto size-12" />
        <p className="text-sm text-text-muted">{message}</p>
        <Button onClick={() => void beginLogin("/")}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-8 text-center">
      <LogoMark className="mx-auto size-12" />
      <Skeleton className="mx-auto h-8 w-48" />
      <p className="text-sm text-text-muted">Signing you in…</p>
    </div>
  );
}
