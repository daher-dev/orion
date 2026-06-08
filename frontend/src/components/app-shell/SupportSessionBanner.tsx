"use client";

import { useTranslations } from "next-intl";
import { ShieldAlert, LogOut } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { useCompany } from "@/providers/company-provider";
import { useMe } from "@/hooks/use-me";

/**
 * Shown across the top of the tenant app while a platform operator is
 * impersonating an organization (a support session). Backend `/v1/auth/me`
 * reports `impersonating: true` in that context. "Encerrar" returns the
 * operator to their own context and back to the Console.
 */
export function SupportSessionBanner() {
  const t = useTranslations("console.impersonation");
  const { data } = useMe();
  const { setCompanyId } = useCompany();
  const router = useRouter();

  if (!data?.impersonating) return null;

  function end() {
    setCompanyId(null);
    router.push("/console");
  }

  return (
    <div className="flex items-center gap-3 bg-[color:var(--console-accent)] px-5 py-2 text-[12.5px] text-white">
      <ShieldAlert size={15} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        {t("banner", { name: data.company?.name ?? "" })}
      </span>
      <button
        type="button"
        onClick={end}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-white/15 px-2.5 py-1 font-medium transition-colors hover:bg-white/25"
      >
        <LogOut size={13} /> {t("end")}
      </button>
    </div>
  );
}
