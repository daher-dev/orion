"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Inline Google "G" mark — kept inline as an SVG so we don't take a runtime
 * dependency on react-icons or @radix-ui/react-icons for a single use.
 * Colours are the official Google brand values (do not theme to the warm
 * palette — Google brand guidelines require the un-tinted multicolour mark).
 */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" aria-hidden className={className}>
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export type GoogleButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  /** Accessible label override — defaults to the i18n key `auth.google`. */
  label?: string;
};

/**
 * Secondary "Continue with Google" button — uses Orion's `.btn` palette
 * (surface bg, line border, ink text) plus the Google mark on the leading
 * edge. Calling `onClick` is the caller's responsibility; this component
 * makes no calls to Firebase directly.
 */
export function GoogleButton({ onClick, disabled, label }: GoogleButtonProps) {
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
      <GoogleMark className="size-[14px]" />
      {label ?? t("google")}
    </Button>
  );
}
