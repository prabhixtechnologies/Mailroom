import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from "react-router";
import { Skeleton } from "@/components/ui/misc";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { CallbackPage } from "@/features/auth/CallbackPage";
import { SignInPage } from "@/features/auth/SignInPage";
import { MailPage } from "@/features/mail/MailPage";
import { PersonalSettingsPage } from "@/features/settings/PersonalSettingsPage";

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
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }
  return isAuthenticated ? (
    <Outlet />
  ) : (
    <Navigate to="/sign-in" replace state={{ from: `${location.pathname}${location.search}` }} />
  );
}

const router = createBrowserRouter([
  { path: "/sign-in", element: <SignInPage /> },
  { path: "/auth/callback", element: <CallbackPage /> },
  {
    element: <Guarded />,
    children: [
      { path: "/", element: <MailPage /> },
      { path: "/settings", element: <PersonalSettingsPage /> },
      // Anything else is a link from an older build or a typed URL. Home is a better answer than a
      // 404 page. Helpdesk queue and mail admin used to live here; they are OneOps /inbox and
      // Settings → Mail now.
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
