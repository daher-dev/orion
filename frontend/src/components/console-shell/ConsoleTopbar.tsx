"use client";

import { useTranslations } from "next-intl";
import { Search, Server, Shield } from "lucide-react";

/**
 * Console top bar — ported from `ConsoleTopbar` in /docs/design/admin/shell.jsx.
 * Search is a non-wired placeholder; env + "internal access" pills are static.
 */
export function ConsoleTopbar() {
  const t = useTranslations("console");
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3.5 border-b border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[18px]">
      <div className="flex h-[34px] max-w-[520px] flex-1 items-center gap-2 rounded-[10px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-3 text-[color:var(--orion-ink-3)]">
        <Search className="size-[14px] shrink-0" strokeWidth={2} />
        <span className="truncate text-[13.5px] leading-none">{t("topbar.searchPlaceholder")}</span>
      </div>
      <div className="flex-1" />
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--orion-line)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--orion-ink-3)]">
        <Server size={12} /> {t("topbar.env")}
      </span>
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
        style={{
          color: "var(--console-accent)",
          background: "color-mix(in oklab, var(--console-accent) 10%, var(--orion-surface))",
        }}
      >
        <Shield size={13} strokeWidth={2.2} /> {t("topbar.internalAccess")}
      </span>
    </header>
  );
}
