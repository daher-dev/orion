"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Orbit, Grid2x2 } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { consoleNav } from "./ConsoleNav";

/**
 * Console left navigation — indigo "night" identity, ported from
 * /docs/design/admin/shell.jsx `ConsoleSidebar`. Distinct from the tenant
 * sidebar on purpose: operators always know they're in platform admin.
 */
export function ConsoleSidebar() {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) =>
    href === "/console" ? pathname === "/console" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside
      className="flex h-screen w-64 shrink-0 flex-col border-r border-[#15110b] text-[rgb(217_210_194_/_0.85)]"
      style={{ background: "linear-gradient(180deg, var(--console-night) 0%, var(--console-night-2) 100%)" }}
    >
      {/* Brand band */}
      <div className="flex h-14 items-center gap-2.5 border-b border-white/5 bg-black/20 px-3.5">
        <span
          className="grid size-[30px] place-items-center rounded-[9px]"
          style={{ background: "linear-gradient(150deg,#c2473b,var(--console-accent))" }}
        >
          <Orbit size={16} strokeWidth={2} className="text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-serif text-[15px] leading-tight font-medium text-[#f5efe0]">Orion</div>
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-[rgb(245_239_224_/_0.72)]">Console</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        {consoleNav.map((section, i) => (
          <div key={i}>
            {section.titleKey && (
              <div className="px-2.5 pt-3.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[rgb(217_210_194_/_0.42)]">
                {t(section.titleKey)}
              </div>
            )}
            <ul className="m-0 list-none p-0">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      data-active={active || undefined}
                      style={{ "--sub-color": item.color } as CSSProperties}
                      className={
                        "group/sb relative my-px flex items-center gap-2.5 rounded-sm border border-transparent px-2.5 py-2 text-[13.5px] leading-none transition-colors " +
                        "hover:bg-white/[0.04] hover:text-[#f5efe0] " +
                        "data-[active]:bg-white/[0.06] data-[active]:border-white/[0.06] data-[active]:text-[#f5efe0] " +
                        "data-[active]:before:absolute data-[active]:before:left-[-10px] data-[active]:before:top-1.5 data-[active]:before:bottom-1.5 data-[active]:before:w-[3px] data-[active]:before:rounded-r-[3px] data-[active]:before:bg-[var(--sub-color)] data-[active]:before:content-['']"
                      }
                    >
                      <Icon className="size-[15px] shrink-0" strokeWidth={2} />
                      <span>{t(item.labelKey)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer — back to the tenant app */}
      <div className="flex items-center gap-2.5 border-t border-white/5 px-3 py-3">
        <span className="grid size-8 place-items-center rounded-full bg-[var(--console-accent)] text-[12px] font-semibold text-white">
          OS
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-medium text-[#f5efe0]">{t("console.sidebar.you")}</div>
          <div className="truncate text-[11px] text-[rgb(217_210_194_/_0.5)]">{t("console.sidebar.team")}</div>
        </div>
        <button
          type="button"
          title={t("console.sidebar.backToApp")}
          onClick={() => router.push("/")}
          className="grid size-8 place-items-center rounded-md text-[rgb(217_210_194_/_0.7)] transition-colors hover:bg-white/[0.06] hover:text-[#f5efe0]"
        >
          <Grid2x2 size={15} />
        </button>
      </div>
    </aside>
  );
}
