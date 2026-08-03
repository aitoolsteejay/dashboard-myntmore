import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";

import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { hasSupabaseConfig } from "@/integrations/supabase/client";

function NotFoundComponent() {
  const navigate = useNavigate()
  const router = useRouter()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <h1 style={{ fontSize: '80px', fontWeight: 'bold', color: '#000' }}>404</h1>
        <p style={{ color: '#666', marginBottom: '32px' }}>Page not found.</p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button onClick={() => router.history.back()}
            style={{ padding: '10px 20px', border: '1px solid #E5E5E5', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>
            ← Go Back
          </button>
          <button onClick={() => navigate({ to: '/dashboard' })}
            style={{ padding: '10px 20px', background: '#FFC947', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: { error: Error }) {
  console.error(error);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  if (!hasSupabaseConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-lg rounded-lg border p-8 text-center">
          <h1 className="text-xl font-semibold">Dashboard configuration missing</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then restart the application.
          </p>
        </div>
      </div>
    )
  }
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppLayout />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AppLayout() {
  const { user, loading, isClient, isAdmin, userRole } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const noSidebarPaths = ['/login', '/accept-invite', '/portal'];
  const isAuthPath = noSidebarPaths.some(p => path.startsWith(p));
  const showSidebar = user && !isAuthPath;

  // Profile is still being fetched if user exists but userRole hasn't resolved yet
  const profileLoading = !!user && userRole === null;

  // Guard: redirect client-only users away from internal pages. A user who is also
  // an admin (e.g. a team member who is additionally one of the agency's clients)
  // is left alone here — they can navigate to /portal on their own via the
  // "View as client" link instead of being forced into it on every page.
  useEffect(() => {
    if (loading || profileLoading) return;
    if (!user) return;
    if (isClient && !isAdmin && !path.startsWith('/portal') && !path.startsWith('/login')) {
      navigate({ to: '/portal' });
    }
  }, [loading, profileLoading, user, isClient, isAdmin, path]);

  if (loading || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!showSidebar) {
    return <Outlet />;
  }

  const pageLabel = path.startsWith('/clients') ? 'Client workspace'
    : path.startsWith('/data-entry') ? 'Data entry'
      : path.startsWith('/actionables') ? 'Actionables'
        : path.startsWith('/monthly-targets') ? 'Monthly targets'
          : path.startsWith('/reports') ? 'Reports'
            : path.startsWith('/settings') ? 'Settings'
              : path.startsWith('/processes') ? 'Processes'
                : path.startsWith('/sales') ? 'Sales & outreach'
                  : path.startsWith('/mm-content') ? 'Myntmore content'
                    : path.startsWith('/tj-personal-brand') ? 'TJ personal brand'
                      : 'Dashboard';

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <main className="min-w-0 flex-1 overflow-auto">
          {path !== '/dashboard' && (
            <div className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <SidebarTrigger aria-label="Toggle navigation" />
              <span className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{pageLabel}</span>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
