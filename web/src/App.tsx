import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from "react-router";
import { Skeleton } from "@/components/ui/misc";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { CallbackPage } from "@/features/auth/CallbackPage";
import { SignInPage } from "@/features/auth/SignInPage";
import { QueuePage } from "@/features/helpdesk/QueuePage";
import { MailPage } from "@/features/mail/MailPage";
import { CannedRepliesPage } from "@/features/settings/CannedRepliesPage";
import {
  MailboxDetailLayout,
  MailboxGeneralSection,
  MailboxMembersSection,
  MailboxRoutingSection,
} from "@/features/settings/MailboxDetailLayout";
import { MailboxesPage } from "@/features/settings/MailboxesPage";
import { SettingsLayout } from "@/features/settings/SettingsLayout";
import { TagsPage } from "@/features/settings/TagsPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Mail changes underneath you, so a stale-forever cache is wrong; a few seconds is enough to stop
      // switching folders back and forth from refetching each time.
      staleTime: 10_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

function Guarded() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }
  return isAuthenticated ? <Outlet /> : <Navigate to="/sign-in" replace />;
}

const router = createBrowserRouter([
  { path: "/sign-in", element: <SignInPage /> },
  { path: "/auth/callback", element: <CallbackPage /> },
  {
    element: <Guarded />,
    children: [
      { path: "/", element: <MailPage /> },
      // The shared-mailbox queue. Routed with the ticket in the path, unlike the mail client, whose
      // selection lives in component state: a ticket is something people send each other links to,
      // and a selection held in useState has no URL to send.
      { path: "/queue", element: <QueuePage /> },
      { path: "/queue/:threadId", element: <QueuePage /> },
      {
        path: "/settings/mailboxes",
        element: <SettingsLayout />,
        children: [
          { index: true, element: <MailboxesPage /> },
          { path: "tags", element: <TagsPage /> },
          { path: "canned-replies", element: <CannedRepliesPage /> },
          {
            path: ":mailboxId",
            element: <MailboxDetailLayout />,
            children: [
              { index: true, element: <MailboxGeneralSection /> },
              { path: "members", element: <MailboxMembersSection /> },
              { path: "routing", element: <MailboxRoutingSection /> },
            ],
          },
        ],
      },
      // Anything else is a link from an older build or a typed URL. Home is a better answer than a
      // 404 page.
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
