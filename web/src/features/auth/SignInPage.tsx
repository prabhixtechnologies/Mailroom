import { useEffect } from "react";
import { LogoMark } from "@/components/LogoMark";
import { Skeleton } from "@/components/ui/misc";
import { beginLogin, isOidcEnabled } from "@/lib/oidc";

/**
 * There is no sign-in form here, and there is not going to be one.
 *
 * <p>Mailroom is an OIDC client. It redirects to the hosted login page on Identity's origin and comes
 * back with a code. That is what makes one sign-in cover the consoles and this app, and it means a
 * cross-site scripting hole in Mailroom cannot steal a password, because Mailroom never receives one.
 */
export function SignInPage() {
  useEffect(() => {
    if (isOidcEnabled()) {
      void beginLogin(window.location.pathname === "/sign-in" ? "/" : undefined);
    }
  }, []);

  if (!isOidcEnabled()) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-8 text-center">
        <LogoMark className="mx-auto size-12" />
        <h1 className="text-lg font-semibold">Mailroom is not configured</h1>
        <p className="text-sm text-text-muted">
          This build has no identity provider set, so there is nowhere to sign in. Whoever deployed it
          needs to build it with an identity issuer.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-8 text-center">
      <LogoMark className="mx-auto size-12" />
      <Skeleton className="mx-auto h-8 w-48" />
      <p className="text-sm text-text-muted">Taking you to sign in…</p>
    </div>
  );
}
