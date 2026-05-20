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
 * Sidebar-header company switcher — faithful port of `.sb-brand` / `.sb-co-picker`
 * from /docs/design/source/styles.css:
 *
 *   .sb-brand        height 56px, padding 14px 16px, gap 10px, border-bottom
 *   .sb-brand-mark   32×32, radius 8, accent bg, serif 17 / weight 600
 *   .sb-brand-name   serif 17 / weight 500 / tracking -.01em, #f5efe0
 *   .sb-brand-sub    serif 10.5 italic, tracking .06em, #f5efe0/60, orbit icon
 *
 * Clickable to swap companies.
 */
export function CompanySwitcher() {
  const t = useTranslations("appShell");
  const { data } = useMe();
  const { companyId, setCompanyId } = useCompany();

  const memberships = data?.companies ?? [];
  const current = data?.company ?? null;

  useEffect(() => {
    if (!companyId && current?.id) {
      setCompanyId(current.id);
    }
  }, [companyId, current?.id, setCompanyId]);

  const activeId = companyId ?? current?.id ?? null;
  const activeName =
    memberships.find((m) => m.id === activeId)?.name ?? current?.name ?? t("noCompany");
  const monogram = activeName.slice(0, 1).toUpperCase();
  // Drive the tile background + orbit dot from the company's saved main_color
  // so the brand color picker in /settings/company is observable here. Falls
  // back to indigo while /v1/auth/me is still loading.
  const brandColor = current?.main_color ?? "#2563eb";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("switchCompany")}
          className={
            // .sb-brand — height 56px, padding 14px 16px, gap 10px, hover transition.
            "flex h-14 w-full items-center gap-2.5 px-4 py-3.5 text-left transition-colors " +
            "hover:bg-white/[0.04] focus-visible:bg-white/[0.04] focus-visible:outline-none " +
            "group-data-[collapsible=icon]:h-14 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          }
        >
          {/*
           * .sb-brand-mark — explicit 32×32 tile, border-radius 8 (NOT
           * --radius-sm; design source pins 8px). Inset white/.1 hairline +
           * coloured drop shadow keep the chip readable on the dark sidebar.
           */}
          <div
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-[8px] font-serif text-[17px] font-semibold leading-none text-white"
            style={{
              background: brandColor,
              boxShadow: `inset 0 0 0 1px rgba(255,255,255,.1), 0 4px 12px -4px ${brandColor}`,
            }}
          >
            {monogram}
          </div>
          <div className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate font-serif text-[17px] font-medium leading-none tracking-[-0.01em] text-[#f5efe0]">
              {activeName}
            </span>
            <span className="mt-1 inline-flex items-center gap-[5px] font-serif text-[10.5px] italic leading-none tracking-[0.06em] text-[#f5efe0]/60">
              <Orbit
                className="size-[9px]"
                strokeWidth={1.8}
                aria-hidden
                style={{ color: brandColor }}
              />
              <span>{t("poweredBy")}</span>
            </span>
          </div>
          <ChevronsUpDown
            aria-hidden
            className="size-3.5 shrink-0 text-[#f5efe0]/55 group-data-[collapsible=icon]:hidden"
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
