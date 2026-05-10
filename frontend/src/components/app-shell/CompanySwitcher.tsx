"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, Orbit } from "lucide-react";
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
 * Sidebar-header company switcher. Renders the active company's monogram +
 * name + "por Orion" sub-line and reveals memberships in a dropdown. Selecting
 * a row stores the id in CompanyProvider, which clears the query cache and
 * triggers a refresh.
 *
 * Styled for the dark warm sidebar (vs the previous tone-light topbar pill).
 */
export function CompanySwitcher() {
  const t = useTranslations("appShell");
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
  const monogram = activeName.slice(0, 1).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group/co-picker flex h-12 w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sidebar-foreground transition-colors hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
        >
          <div
            className="grid size-8 shrink-0 place-items-center rounded-md bg-sidebar-primary font-serif text-[17px] font-semibold text-sidebar-primary-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1),0_4px_12px_-4px_var(--sidebar-primary)]"
            aria-hidden
          >
            {monogram}
          </div>
          <div className="flex min-w-0 flex-1 flex-col leading-none group-data-[collapsible=icon]:hidden">
            <span className="truncate font-serif text-[16px] font-medium tracking-tight text-sidebar-foreground">
              {activeName}
            </span>
            <span className="mt-1 flex items-center gap-1.5 font-serif text-[10.5px] italic tracking-[0.06em] text-sidebar-foreground/60">
              <Orbit className="size-[9px] text-sidebar-primary" aria-hidden />
              <span>{t("poweredBy")}</span>
            </span>
          </div>
          <ChevronsUpDown
            className="size-3.5 shrink-0 text-sidebar-foreground/55 group-data-[collapsible=icon]:hidden"
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="min-w-[220px]">
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
