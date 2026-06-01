"use client";

import { FlaskConical, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Billing pane hero — direct port of the "Hero plan" block in
 * /docs/design/source/pages/settings.jsx (`BillingPane`, lines ~420-450).
 *
 * Visual:
 *  - Full-width card shell with padding 0 and overflow hidden.
 *  - Inner div with padding 24/26, a top-to-bottom gradient from a 5%-accent
 *    surface tint to plain --orion-surface, and a 220×220 radial halo in the
 *    top-right corner at 28% accent opacity / .5 alpha.
 *  - .page-eyebrow with an 18×18 accent-colored mark wrapping a Sparkles icon
 *    + "Plano atual" label (uppercase 11px / .12em tracking).
 *  - Plan name in Fraunces 42px / 400 / -0.025em / lh 1, sitting on the same
 *    baseline as a Beta privada pill (surface-2 bg, ink-2 color, FlaskConical
 *    icon 11px).
 *  - Body copy: 13px ink-3, max-width 60ch.
 *
 * We map the design's `var(--accent)` to our `--sidebar-primary` token
 * (the Ember UI accent) — same role, different name.
 */
type Props = {
  /** Display name of the active plan (e.g. "Pro"). */
  planName: string;
};

export function BillingHero({ planName }: Props) {
  const t = useTranslations("settings.billing.hero");

  return (
    <div
      className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0"
      data-testid="billing-hero"
    >
      <div
        className="relative overflow-hidden px-[26px] py-[24px]"
        // Linear gradient from a 5% accent tint at the top to plain surface
        // at the bottom — exact rule from the design source.
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--sidebar-primary) 5%, var(--orion-surface)) 0%, var(--orion-surface) 100%)",
        }}
      >
        {/* Radial halo — 220×220 circle, top -60 / right -40, accent at 28%
            fading to transparent at 70%, opacity .5, behind the content. */}
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            top: -60,
            right: -40,
            width: 220,
            height: 220,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, color-mix(in oklab, var(--sidebar-primary) 28%, transparent) 0%, transparent 70%)",
            opacity: 0.5,
          }}
        />
        {/* .page-eyebrow — accent color, 11px / .12em / uppercase / 600. */}
        <div
          className="relative inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--sidebar-primary)" }}
        >
          {/* .page-eyebrow-mark — 18×18, rounded-4, accent bg, white sparkles. */}
          <span
            className="grid h-[18px] w-[18px] place-items-center rounded-[4px] text-white"
            style={{ background: "var(--sidebar-primary)" }}
          >
            <Sparkles size={11} strokeWidth={2.2} />
          </span>
          {t("eyebrow")}
        </div>
        {/* Plan name + Beta pill — baseline-aligned with 14px gap, mt 8px. */}
        <div className="relative mt-2 flex items-baseline gap-[14px]">
          <span className="font-serif text-[42px] font-normal leading-none tracking-[-0.025em] text-[color:var(--orion-ink)]">
            {planName}
          </span>
          {/* .pill with surface-2 bg + ink-2 color (matches the design source
              override on the base .pill rules). 11.5px / 500. */}
          <span className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] px-2 py-px text-[11.5px] font-medium leading-[1.5] text-[color:var(--orion-ink-2)]">
            <FlaskConical size={11} strokeWidth={2} />
            {t("betaPill")}
          </span>
        </div>
        {/* Body copy — 13px ink-3, max-w 60ch, mt 8px. */}
        <p className="relative mt-2 max-w-[60ch] text-[13px] leading-[1.5] text-[color:var(--orion-ink-3)]">
          {t("body")}
        </p>
      </div>
    </div>
  );
}
