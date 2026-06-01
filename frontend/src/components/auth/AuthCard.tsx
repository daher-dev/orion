import type { ReactNode } from "react";
import { Logo } from "@/components/brand";

/**
 * Shared shell for every auth/public page (login, access-denied,
 * forgot-password, accept-invite). Direct port of the Orion `.card` from
 * /docs/design/source/styles.css — bg = --orion-surface, 1 px line border,
 * 14 px radius, overflow hidden — plus the Orion brand mark (O tile +
 * "Orion" wordmark), so the auth pages feel like one continuous brand surface.
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
        {/* Brand mark — the canonical Orion lockup (app-icon tile + wordmark
            with the belt-"i"), so the visual identity travels with the user
            from the login page into the app. */}
        <Logo layout="horizontal" size={32} className="text-[color:var(--orion-ink)]" />

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
