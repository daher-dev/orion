"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Logo, BeltLoader } from "@/components/brand";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/providers/auth-provider";
import { useCompany } from "@/providers/company-provider";
import { useMe } from "@/hooks/use-me";
import { useRouter } from "@/i18n/routing";
import { ConsoleSidebar } from "./ConsoleSidebar";
import { ConsoleTopbar } from "./ConsoleTopbar";

/**
 * ConsoleShell wraps every Platform Console page.
 *
 * Access gate: requires a signed-in user whose `is_operator` is true. Anyone
 * else is bounced to the tenant app root. Mirrors AppShell's loading/redirect
 * discipline (act inside an effect, render a branded splash until settled).
 *
 * The whole tree is scoped under `.console-scope` so console components pick up
 * the indigo --console-accent without touching the tenant Ember theme.
 */
export function ConsoleShell({ children }: { children: ReactNode }) {
  const t = useTranslations("appShell");
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { companyId, setCompanyId } = useCompany();
  const { data, isPending: meLoading, isError } = useMe();

  const isOperator = data?.user?.is_operator === true;

  // The console is the operator's own platform context — never a tenant. Clear
  // any leftover active-company id (e.g. a stale localStorage id) exactly once
  // on entry so /me and /v1/admin/* run un-impersonated. Must run a single time:
  // reacting to later companyId changes would wipe the id that "Entrar como"
  // sets right before it navigates into the tenant app.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (companyId) setCompanyId(null);
  }, [companyId, setCompanyId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (meLoading || isError || data === undefined) return;
    // Signed in but not a platform operator → no console access.
    if (!isOperator) router.replace("/");
  }, [authLoading, user, meLoading, isError, data, isOperator, router]);

  if (authLoading || (user && (meLoading || data === undefined))) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-7 p-8">
        <Logo layout="stacked" size={56} />
        <div className="flex flex-col items-center gap-3" role="status">
          <BeltLoader size={52} className="text-[color:var(--console-accent)]" />
          <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--orion-ink-3)]">
            {t("loading")}
          </span>
        </div>
      </div>
    );
  }

  if (!user || !isOperator) return null;

  return (
    <div className="console-scope flex min-h-screen bg-[color:var(--orion-bg)]">
      <ConsoleSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <ConsoleTopbar />
        <main className="flex-1 px-7 pt-[22px] pb-16">
          <div className="mx-auto max-w-[1240px]">{children}</div>
        </main>
        <Toaster richColors position="top-right" />
      </div>
    </div>
  );
}
