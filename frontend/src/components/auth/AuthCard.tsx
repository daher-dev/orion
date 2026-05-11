import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Orbit } from "lucide-react";

/**
 * Shared shell for every auth/public page (login, signup, forgot-password,
 * onboarding, accept-invite). Direct port of the Orion `.card` from
 * /docs/design/source/styles.css — bg = --orion-surface, 1 px line border,
 * 14 px radius, overflow hidden — plus the Underground brand mark (U tile +
 * "Orion" wordmark + "por Underground" italic sub) the same way the sidebar
 * `CompanySwitcher` renders it, so the auth pages feel like one continuous
 * brand surface.
 *
 * The card is centered by the `(public)` route layout — this component does
 * not impose its own max-width beyond `420px` so layouts that need a wider
 * dialog (e.g. invite accept errors) can override via className.
 */
export type AuthCardProps = {
  title: string;
  /** Optional sub-line under the title. Falsy hides the row. */
  sub?: ReactNode;
  children: ReactNode;
  /** Append additional classes to the outer card surface. */
  className?: string;
  /** Optional content rendered between the brand mark and the title — banners. */
  banner?: ReactNode;
};

export function AuthCard({ title, sub, children, className, banner }: AuthCardProps) {
  const t = useTranslations("auth.brand");

  return (
    <div
      className={
        // .card from design source: surface bg, line border, 14px radius.
        // 420 px max width so the form feels compact on a wide screen.
        "w-full max-w-[420px] overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] shadow-[0_1px_2px_rgba(31,27,21,.05),0_6px_18px_-8px_rgba(31,27,21,.10)] " +
        (className ?? "")
      }
    >
      {/* Card pad: roomier than table cards (auth pages have low content density). */}
      <div className="flex flex-col gap-5 px-7 pt-9 pb-8">
        {/* Brand mark row — same construction as the sidebar CompanySwitcher
            so the visual identity travels with the user from the login page
            into the app. */}
        <div className="flex items-center gap-2.5">
          <div
            aria-hidden
            className={
              "grid size-8 shrink-0 place-items-center rounded-lg font-serif text-[17px] font-semibold leading-none text-white " +
              "[box-shadow:inset_0_0_0_1px_rgba(255,255,255,.1),0_4px_12px_-4px_#2563eb] " +
              "bg-[#2563eb]"
            }
          >
            U
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-serif text-[17px] font-medium leading-none tracking-[-0.01em] text-[color:var(--orion-ink)]">
              {t("wordmark")}
            </span>
            <span className="mt-1 inline-flex items-center gap-[5px] font-serif text-[10.5px] italic leading-none tracking-[0.06em] text-[color:var(--orion-ink-3)]">
              <Orbit className="size-[9px] text-[#2563eb]" strokeWidth={1.8} aria-hidden />
              <span>{t("poweredBy")}</span>
            </span>
          </div>
        </div>

        {banner}

        <div className="flex flex-col gap-1.5">
          {/* Fraunces 26 px, weight 400, tight tracking — matches the .page-title scale. */}
          <h1 className="font-serif text-[26px] font-normal leading-[1.1] tracking-[-0.02em] text-[color:var(--orion-ink)]">
            {title}
          </h1>
          {sub ? (
            <p className="text-[13.5px] leading-[1.45] text-[color:var(--orion-ink-3)]">{sub}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}
