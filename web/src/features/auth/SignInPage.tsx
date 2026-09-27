import { useEffect } from "react";
import { useLocation } from "react-router";
import { LogoMark } from "@/components/LogoMark";
import { SkipLink } from "@/components/SkipLink";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { beginLogin, isOidcEnabled } from "@prabhix/oidc-client";
import "@/lib/oidc-config";
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
  const { sessionRecoveryReason, clearSessionRecoveryReason } = useAuth();
  const securitySignIn = sessionRecoveryReason === "security_revoked";

  useEffect(() => {
    if (!isOidcEnabled() || securitySignIn) return;
    const from = safeAppPath((location.state as { from?: string } | null)?.from);
    void beginLogin(from);
  }, [location.state, securitySignIn]);

  if (!isOidcEnabled()) {
    return (
      <div id="main-content" className="mr-gate">
        <SkipLink />
        <LogoMark className="mx-auto mb-5 size-10" />
        <div className="mr-lockup">
          <div className="mr-lockup__name">Mailroom</div>
          <div className="mr-lockup__tag">Company communication</div>
        </div>
        <h1 className="font-display text-xl font-medium tracking-tight">Mailroom is not configured</h1>
        <p className="mt-2 max-w-sm text-sm text-text-muted">
          This build has no identity provider set, so there is nowhere to sign in. Whoever deployed it
          needs to build it with an identity issuer.
        </p>
      </div>
    );
  }

  if (securitySignIn) {
    const from = safeAppPath((location.state as { from?: string } | null)?.from);
    return (
      <div id="main-content" className="mr-gate">
        <SkipLink />
        <LogoMark className="mx-auto mb-5 size-10" />
        <div className="mr-lockup">
          <div className="mr-lockup__name">Mailroom</div>
          <div className="mr-lockup__tag">Company communication</div>
        </div>
        <h1 className="font-display text-xl font-medium tracking-tight">Sign in again after the security update</h1>
        <p className="mt-2 max-w-md text-sm text-text-muted">
          Your previous session was revoked as part of a platform security update. Mail and settings are
          unchanged — sign in once to continue on this device.
        </p>
        <Button
          className="mt-5"
          onClick={() => {
            clearSessionRecoveryReason();
            void beginLogin(from);
          }}
        >
          Continue to sign in
        </Button>
      </div>
    );
  }

  return (
    <div id="main-content" className="mr-gate">
      <SkipLink />
      <LogoMark className="mx-auto mb-5 size-10" />
      <div className="mr-lockup">
        <div className="mr-lockup__name">Mailroom</div>
        <div className="mr-lockup__tag">Company communication</div>
      </div>
      <h1 className="font-display text-xl font-medium tracking-tight">Taking you to sign in</h1>
      <p className="mt-2 text-sm text-text-muted">One Prabhix account for every product.</p>
    </div>
  );
}
