"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/providers/auth-provider";
import { useMe } from "@/hooks/use-me";
import { useEstablishSession } from "@/hooks/use-session";
import { qk } from "@/lib/query-keys";
import { ApiError } from "@/lib/api-client";
import { useRouter } from "@/i18n/routing";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/**
 * AppShell wraps every authenticated page.
 *
 * Responsibilities
 * - Auth guard: if no Firebase user, redirect to /login.
 * - Access gate: if signed-in but with no membership, establish the backend
 *   session (POST /v1/auth/session). It provisions the user from a matching
 *   pending invite, or rejects with 403 → redirect to /access-denied.
 * - Render the chrome: SidebarProvider > Sidebar + (Topbar + main).
 *
 * Loading state: render a centered skeleton until auth + /v1/auth/me settle.
 * Doing the redirect inside an effect keeps the component tree consistent
 * across re-renders and avoids a flash of authed content.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations("appShell");
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { data, isPending: meLoading, isError } = useMe();
  const establishSession = useEstablishSession();
  const qc = useQueryClient();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    // /v1/auth/me hasn't resolved yet — wait. (Errors fall through and let
    // the user see the empty state; the API client will surface them.)
    if (meLoading || isError) return;
    // When data is undefined the query is still loading or was just cleared
    // (e.g. after a cache invalidation) — never act in that transient state.
    if (data === undefined) return;
    if (data.user) return; // Provisioned member → render the app.

    // Signed into Firebase but no membership resolved yet. Establish the
    // session: the backend provisions the user from a matching pending invite,
    // or rejects with 403 `not_invited`. Guard on isIdle so this fires once.
    if (establishSession.isIdle) {
      establishSession.mutate(undefined, {
        onSuccess: () => {
          void qc.invalidateQueries({ queryKey: qk.auth.me() });
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 403) {
            router.replace("/access-denied");
          }
        },
      });
    }
  }, [authLoading, user, meLoading, isError, data, establishSession, qc, router]);

  if (
    authLoading ||
    (user && (meLoading || data === undefined)) ||
    establishSession.isPending
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="w-full max-w-md space-y-3" aria-label={t("loading")}>
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  // Awaiting redirect — render nothing to avoid flicker.
  if (!user || (data !== undefined && !data.user)) return null;

  // Override shadcn's defaults so the sidebar matches the design source:
  //   --sb-w             256px (shadcn default already 16rem ✓)
  //   --sb-w-collapsed   68px  (shadcn default 3rem / 48px — override)
  // shadcn reads --sidebar-width-icon for the collapsed (icon-only) state.
  const shellStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "68px",
  } as CSSProperties;

  return (
    <SidebarProvider style={shellStyle}>
      <Sidebar />
      <SidebarInset>
        <Topbar />
        {/* .page from design: padding 22 28 64, max-w 1480, centered */}
        <main className="flex-1 px-7 pt-[22px] pb-16">
          <div className="mx-auto max-w-[1480px]">{children}</div>
        </main>
        <Toaster richColors position="top-right" />
      </SidebarInset>
    </SidebarProvider>
  );
}
