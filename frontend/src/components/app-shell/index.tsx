"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/providers/auth-provider";
import { useMe } from "@/hooks/use-me";
import { useRouter, usePathname } from "@/i18n/routing";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/**
 * AppShell wraps every authenticated page.
 *
 * Responsibilities
 * - Auth guard: if no Firebase user, redirect to /login.
 * - Onboarding guard: if signed-in but no User row in any company yet,
 *   redirect to /onboarding.
 * - Render the chrome: SidebarProvider > Sidebar + (Topbar + main).
 *
 * Loading state: render a centered skeleton until auth + /v1/auth/me settle.
 * Doing the redirect inside an effect keeps the component tree consistent
 * across re-renders and avoids a flash of authed content.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations("appShell");
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const { data, isPending: meLoading, isError } = useMe();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    // /v1/auth/me hasn't resolved yet — wait. (Errors fall through and let
    // the user see the empty state; the API client will surface them.)
    if (meLoading) return;
    if (isError) return;
    // Only redirect when data has settled and explicitly has no user row.
    // When data is undefined the query is still loading or was just cleared
    // (e.g. after a cache invalidation) — never redirect in that transient state.
    if (data !== undefined && !data.user) {
      // Signed in to Firebase but no User row anywhere → onboarding.
      if (!pathname.startsWith("/onboarding")) {
        router.replace("/onboarding");
      }
    }
  }, [authLoading, user, meLoading, isError, data, router, pathname]);

  if (authLoading || (user && (meLoading || data === undefined))) {
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

  return (
    <SidebarProvider>
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
