"use client";

import { useTranslations } from "next-intl";

/**
 * Inline Google "G" mark — official multicolour brand values (do NOT tint to
 * the warm palette; Google's brand guidelines require the un-tinted mark).
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

/** Inline Apple mark — monochrome, inherits the button ink via currentColor. */
function AppleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 17" aria-hidden className={className} fill="currentColor">
      <path d="M11.62 9.04c-.02-1.86 1.52-2.75 1.59-2.79-.87-1.27-2.22-1.44-2.7-1.46-1.15-.12-2.24.67-2.82.67-.58 0-1.48-.65-2.43-.64-1.25.02-2.4.73-3.05 1.84-1.3 2.25-.33 5.58.93 7.41.62.9 1.36 1.9 2.32 1.86.93-.04 1.28-.6 2.41-.6 1.12 0 1.44.6 2.42.58 1-.02 1.63-.91 2.24-1.81.71-1.04 1-2.05 1.02-2.1-.02-.01-1.95-.75-1.96-2.97ZM9.76 3.52c.51-.62.86-1.49.76-2.35-.74.03-1.63.49-2.16 1.11-.47.55-.89 1.43-.78 2.27.82.07 1.67-.42 2.18-1.03Z" />
    </svg>
  );
}

export type ProviderRowProps = {
  onGoogle: () => void;
  onApple: () => void;
  disabled?: boolean;
};

/**
 * Compact provider row — the `.prov-row` / `.prov-btn` treatment from the
 * Login design: equal-width chips with a leading brand mark and the short
 * brand name. Collapses to a single column on narrow screens. The accessible
 * name is the full "Continue with …" phrase (i18n) so screen readers and tests
 * read a complete CTA even though the visible label is just the brand name.
 */
export function ProviderRow({ onGoogle, onApple, disabled }: ProviderRowProps) {
  const t = useTranslations("auth");

  const providers = [
    { id: "google", label: "Google", aria: t("google"), Mark: GoogleMark, onClick: onGoogle },
    { id: "apple", label: "Apple", aria: t("apple"), Mark: AppleMark, onClick: onApple },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-2 max-[480px]:grid-cols-1">
      {providers.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-label={p.aria}
          onClick={p.onClick}
          disabled={disabled}
          className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-2 py-2.5 text-[13px] font-medium text-[color:var(--orion-ink)] transition-colors hover:border-[color:color-mix(in_oklab,var(--orion-ink)_18%,var(--orion-line))] hover:bg-[color:var(--orion-bg)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--orion-ink-3)_16%,transparent)] disabled:pointer-events-none disabled:opacity-60 max-[480px]:justify-start max-[480px]:px-3.5"
        >
          <span className="inline-flex size-[18px] items-center justify-center">
            <p.Mark className={p.id === "apple" ? "size-[15px]" : "size-[18px]"} />
          </span>
          <span>{p.label}</span>
        </button>
      ))}
    </div>
  );
}
