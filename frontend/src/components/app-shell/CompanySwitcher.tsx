"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMe } from "@/hooks/use-me";
import { useCompany } from "@/providers/company-provider";

/**
 * Top-bar dropdown that lets the user switch between companies they
 * belong to. Selecting an entry stores the id in CompanyProvider, which
 * clears the query cache and triggers a refresh.
 */
export function CompanySwitcher() {
  const t = useTranslations("topbar");
  const { data } = useMe();
  const { companyId, setCompanyId } = useCompany();

  const memberships = data?.companies ?? [];
  const current = data?.company ?? null;

  // Bootstrap: if context has no companyId yet, latch onto the current one
  // returned by /v1/auth/me so the API client starts sending the header.
  useEffect(() => {
    if (!companyId && current?.id) {
      setCompanyId(current.id);
    }
  }, [companyId, current?.id, setCompanyId]);

  const activeId = companyId ?? current?.id ?? null;
  const activeName =
    memberships.find((m) => m.id === activeId)?.name ?? current?.name ?? t("noCompany");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Building2 className="size-4" />
          <span className="max-w-[160px] truncate text-left">{activeName}</span>
          <ChevronsUpDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        <DropdownMenuLabel>{t("switchCompany")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.length === 0 ? (
          <DropdownMenuItem disabled>{t("noMemberships")}</DropdownMenuItem>
        ) : (
          memberships.map((m) => (
            <DropdownMenuItem
              key={m.id}
              onSelect={() => setCompanyId(m.id)}
              className="flex items-center justify-between gap-2"
            >
              <span className="truncate">{m.name}</span>
              {m.id === activeId ? <Check className="size-4 opacity-70" /> : null}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
