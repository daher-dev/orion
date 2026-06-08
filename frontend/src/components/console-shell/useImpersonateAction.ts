"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/i18n/routing";
import { useCompany } from "@/providers/company-provider";
import { useImpersonate } from "@/hooks/use-admin";

type Target = { id: string; name: string };

/**
 * Start a real support session: audit on the backend, switch the active company
 * context to the target tenant, then drop the operator into the tenant app. The
 * api-client sends X-Orion-Company-Id from CompanyProvider, so every subsequent
 * request runs inside the impersonated company (see backend get_current_db_user).
 */
export function useImpersonateAction() {
  const t = useTranslations("console");
  const router = useRouter();
  const qc = useQueryClient();
  const { setCompanyId } = useCompany();
  const impersonate = useImpersonate();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function run(target: Target) {
    setPendingId(target.id);
    impersonate.mutate(target.id, {
      onSuccess: () => {
        setCompanyId(target.id);
        // Entering a support session is a context switch: drop any cached
        // console/operator data so the tenant app refetches /me (and everything
        // else) under the impersonated company header.
        qc.clear();
        toast.success(t("impersonation.started", { name: target.name }));
        router.push("/");
      },
      onError: (err) => {
        setPendingId(null);
        toast.error(err.detail ?? t("impersonation.error"));
      },
    });
  }

  return { run, pendingId };
}
