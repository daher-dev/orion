"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Inline Apple mark — kept inline as a monochrome SVG (uses currentColor) so it
 * inherits the button's ink color and we avoid an icon-pack dependency for a
 * single glyph.
 */
function AppleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 17" aria-hidden className={className} fill="currentColor">
      <path d="M11.62 9.04c-.02-1.86 1.52-2.75 1.59-2.79-.87-1.27-2.22-1.44-2.7-1.46-1.15-.12-2.24.67-2.82.67-.58 0-1.48-.65-2.43-.64-1.25.02-2.4.73-3.05 1.84-1.3 2.25-.33 5.58.93 7.41.62.9 1.36 1.9 2.32 1.86.93-.04 1.28-.6 2.41-.6 1.12 0 1.44.6 2.42.58 1-.02 1.63-.91 2.24-1.81.71-1.04 1-2.05 1.02-2.1-.02-.01-1.95-.75-1.96-2.97ZM9.76 3.52c.51-.62.86-1.49.76-2.35-.74.03-1.63.49-2.16 1.11-.47.55-.89 1.43-.78 2.27.82.07 1.67-.42 2.18-1.03Z" />
    </svg>
  );
}

export type AppleButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  /** Accessible label override — defaults to the i18n key `auth.apple`. */
  label?: string;
};

/**
 * Secondary "Continue with Apple" button — mirrors GoogleButton's use of the
 * Orion `.btn` palette. Calling `onClick` is the caller's responsibility; this
 * component makes no calls to Firebase directly.
 */
export function AppleButton({ onClick, disabled, label }: AppleButtonProps) {
  const t = useTranslations("auth");
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className={
        // Match `.btn` from design source: 7×13 padding, 6px radius, 13px
        // weight-500, surface bg, line border, ink text. Hover -> surface-2.
        "h-auto w-full justify-center gap-2 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--orion-ink-3)_16%,transparent)] focus-visible:outline-none"
      }
    >
      <AppleMark className="size-[15px]" />
      {label ?? t("apple")}
    </Button>
  );
}
