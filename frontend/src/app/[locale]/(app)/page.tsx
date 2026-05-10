import { useTranslations } from "next-intl";

/**
 * Dashboard placeholder. F-015 will replace this with the real dashboard.
 * Keeping the markup minimal here so the design's `.page-head` rhythm
 * (eyebrow + 30px serif title + ink-3 subtitle) is the only thing on screen
 * until F-015 lands.
 */
export default function HomePage() {
  const t = useTranslations("home");

  return (
    <header className="flex max-w-[640px] flex-col gap-1.5">
      {/* .page-title — design source: font-display 30px, weight 400, tracking -.025em, lh 1.05 */}
      <h1 className="font-serif text-[30px] font-normal leading-[1.05] tracking-[-0.025em] text-[color:var(--orion-ink)]">
        {t("title")}
      </h1>
      {/* .page-sub — design source: ink-3, 13px, max-w 60ch */}
      <p className="max-w-[60ch] text-[13px] leading-[1.5] text-[color:var(--orion-ink-3)]">{t("subtitle")}</p>
    </header>
  );
}
