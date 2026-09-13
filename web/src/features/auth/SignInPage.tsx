import { useEffect } from "react";
import { useLocation } from "react-router";
import { LogoMark } from "@/components/LogoMark";
import { SkipLink } from "@/components/SkipLink";
import { beginLogin, isOidcEnabled } from "@/lib/oidc";
import { safeAppPath } from "@/lib/safePath";

/**
 * There is no sign-in form here, and there is not going to be one.
 *
 * <p>Mailroom is an OIDC client. It redirects to the hosted login page on Identity's origin and comes
 * back with a code. That is what makes one sign-in cover the consoles and this app, and it means a
 * cross-site scripting hole in Mailroom cannot steal a password, because Mailroom never receives one.
 */
export function SignInPage() {
  const location = useLocation();
  useEffect(() => {
    if (isOidcEnabled()) {
      const from = safeAppPath((location.state as { from?: string } | null)?.from);
      void beginLogin(from);
    }
  }, [location.state]);

  if (!isOidcEnabled()) {
    return (
      <div id="main-content" className="mx-auto max-w-md space-y-4 p-8 text-center">
        <SkipLink />
        <LogoMark className="mx-auto size-12" />
        <h1 className="font-display text-lg font-semibold tracking-tight">Mailroom is not configured</h1>
        <p className="text-sm text-text-muted">
          This build has no identity provider set, so there is nowhere to sign in. Whoever deployed it
          needs to build it with an identity issuer.
        </p>
      </div>
    );
  }

  return (
    <div id="main-content" className="mx-auto max-w-md space-y-4 p-8 text-center">
      <SkipLink />
      <LogoMark className="mx-auto size-12" />
      <h1 className="font-display text-lg font-semibold tracking-tight">Taking you to sign in</h1>
      <p className="text-sm text-text-muted">One Prabhix account for every product.</p>
    </div>
  );
}
