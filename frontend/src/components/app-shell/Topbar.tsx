"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Menu, Search, Shield, Sparkles } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { Link } from "@/i18n/routing";
import { useMe } from "@/hooks/use-me";
import { useSeenRelease } from "@/hooks/use-seen-release";
import { CommandPalette } from "./CommandPalette";

/**
 * Top app bar — faithful port of `.topbar`, `.tb-burger`, `.tb-search` from
 * /docs/design/source/styles.css:
 *
 *   .topbar       height 56, bg surface, border-bottom line, padding 0 18,
 *                 gap 14, sticky.
 *   .tb-burger    32×32, radius 6, transparent, ink-2 → ink on hover.
 *   .tb-search    flex 1, max 520, bg paper, border line, radius 10,
 *                 padding 7 12, gap 8, color ink-3.
 *   .tb-search kbd  mono 10.5, bg surface, border line, padding 1 5, rounded 4.
 */
export function Topbar() {
  const t = useTranslations("topbar");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { toggleSidebar } = useSidebar();
  const { data: me } = useMe();
  const isOperator = me?.user?.is_operator === true;
  const locale = useLocale();
  const { hasUnseen } = useSeenRelease(locale);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header
      data-orion-paper
      // .topbar — height 56, bg surface (#fbf8f2) + paper grain via the
      // shared --orion-grain layer (see globals.css), border-bottom line,
      // padding 0 18, gap 14.
      className="sticky top-0 z-30 flex h-14 items-center gap-3.5 border-b border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[18px]"
    >
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={t("toggleSidebar")}
        // .tb-burger — 32×32, radius var(--radius-sm) [6px], ink-2 → hover
        // surface-2 + ink. lucide Menu uses default 2 strokeWidth in the
        // design source.
        className="grid size-8 shrink-0 place-items-center rounded-sm text-[color:var(--orion-ink-2)] transition-colors hover:bg-[color:var(--orion-surface-2)] hover:text-[color:var(--orion-ink)]"
      >
        <Menu className="size-[18px]" strokeWidth={2} />
      </button>

      {/*
       * .tb-search — flex 1, max-width 520, bg --orion-bg (paper cream),
       * border --orion-line, radius var(--radius) [10px], padding 7px 12px,
       * gap 8, color --orion-ink-3. Inherits body font (14px) so the label
       * sits in the same type rhythm as the rest of the topbar.
       */}
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        aria-label={t("search")}
        className={
          "flex h-[34px] max-w-[520px] flex-1 items-center gap-2 rounded-[10px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-3 py-[7px] text-left text-[color:var(--orion-ink-3)] transition-colors " +
          "hover:border-[color:color-mix(in_oklab,var(--ring)_30%,var(--orion-line))]"
        }
      >
        <Search className="size-[14px] shrink-0" strokeWidth={2} />
        <span className="truncate text-[13.5px] leading-none">{t("searchPlaceholder")}</span>
        {/* .tb-search kbd — mono 10.5, bg --surface, border --line, padding 1 5, radius 4 */}
        <kbd className="ml-auto rounded-[4px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[5px] py-px font-mono text-[10.5px] leading-none text-[color:var(--orion-ink-3)]">
          ⌘K
        </kbd>
      </button>

      {/* .tb-spacer — flex 1 — fills the gap between search and the right side */}
      <div className="flex-1" />
      {/* .tb-news — "Novidades" link with a pulsing dot until the latest release is seen */}
      <Link href="/novidades" title={t("news")} className="tb-news">
        <Sparkles size={14} strokeWidth={2} />
        <span>{t("news")}</span>
        {hasUnseen ? <span className="tb-news-dot" aria-hidden /> : null}
      </Link>
      {isOperator ? (
        <Link
          href="/console"
          title={t("console")}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-[color:var(--console-accent)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--console-accent)_10%,var(--orion-surface))]"
        >
          <Shield size={13} strokeWidth={2.2} /> {t("console")}
        </Link>
      ) : null}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
