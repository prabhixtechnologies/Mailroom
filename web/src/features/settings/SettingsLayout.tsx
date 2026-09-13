import { Link, Outlet, useLocation } from "react-router";
import { ArrowLeft, Mail, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { EmptyState } from "@/components/ui/misc";
import { useAuth } from "@/lib/auth";
import { ApiClientError } from "@/lib/api-client";
import { PERMISSION_MAILBOX_MANAGE, PERMISSION_THREAD_UPDATE } from "@/lib/mailbox-admin";
import { cn } from "@/lib/utils";
import { SkipLink } from "@/components/SkipLink";

/**
 * Shell for mailbox administration: a sidebar of sections and a content area.
 *
 * The two permissions are not interchangeable. Mailbox and routing writes need
 * MAIL_MAILBOX_MANAGE; tag and canned-reply writes need MAIL_THREAD_UPDATE, because agents create
 * those while triaging. Each section is listed only when its own permission is held, so the nav
 * never offers a page whose every action would come back 403.
 */
export function SettingsLayout() {
  const { permissions } = useAuth();
  const location = useLocation();
  const canManageMailboxes = permissions.includes(PERMISSION_MAILBOX_MANAGE);
  const canManageVocabulary = permissions.includes(PERMISSION_THREAD_UPDATE);

  if (!canManageMailboxes && !canManageVocabulary) {
    return (
      <div className="flex h-[100dvh] flex-col">
        <SettingsHeader />
        <EmptyState
          icon={<Settings className="size-8" />}
          title="You do not have permission to change mail settings"
          hint="Ask an administrator for the Mail mailbox manage permission."
        />
      </div>
    );
  }

  const nav = [
    { to: "/settings/mailboxes", label: "Mailboxes", exact: true, allowed: canManageMailboxes },
    { to: "/settings/mailboxes/tags", label: "Tags", exact: false, allowed: canManageVocabulary },
    {
      to: "/settings/mailboxes/canned-replies",
      label: "Canned replies",
      exact: false,
      allowed: canManageVocabulary,
    },
  ].filter((item) => item.allowed);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <SkipLink />
      <SettingsHeader />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="hidden w-52 shrink-0 border-r border-border bg-surface-muted/30 p-3 md:block">
          <nav className="space-y-0.5">
            {nav.map((item) => {
              const active = item.exact
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/15 font-medium text-primary"
                      : "text-text-muted hover:bg-surface-muted hover:text-text",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <nav className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden">
          {nav.map((item) => {
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={`m-${item.to}`}
                to={item.to}
                className={cn(
                  "shrink-0 rounded-md px-3 py-2 text-sm transition-colors min-h-11 inline-flex items-center",
                  active
                    ? "bg-primary/15 font-medium text-primary"
                    : "text-text-muted hover:bg-surface-muted hover:text-text",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main id="main-content" tabIndex={-1} className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SettingsHeader() {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
      <Link
        to="/"
        className="inline-flex size-11 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text"
        aria-label="Back to mail"
      >
        <ArrowLeft className="size-4" />
      </Link>
      <Settings className="size-4 text-text-muted" />
      <span className="text-sm font-semibold">Mail settings</span>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <Link
          to="/queue"
          className="rounded-md px-2 py-1 text-xs text-text-muted hover:bg-surface-muted"
        >
          <Mail className="mr-1 inline size-3" />
          Queue
        </Link>
      </div>
    </header>
  );
}

/** Surfaces a 403 from the API as a permission message rather than a generic failure. */
export function adminErrorHint(err: unknown): string | undefined {
  if (err instanceof ApiClientError && err.status === 403) {
    return "You do not have permission to make that change.";
  }
  return undefined;
}
