"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary for /clients. Surfaces a brief retry affordance
 * and uses the design's `.empty` rhythm so the failure feels in-system.
 */
export default function ClientsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");
  return (
    <div className="px-6 py-14 text-center text-[color:var(--orion-ink-3)]">
      <h3 className="mb-1.5 font-serif text-[17px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
        {t("error")}
      </h3>
      <div className="mx-auto mb-3 max-w-[360px] text-[13px] leading-[1.5]">
        {error.message}
      </div>
      <Button
        type="button"
        onClick={reset}
        variant="outline"
        className="h-auto rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] hover:bg-[color:var(--orion-surface-2)]"
      >
        {t("back")}
      </Button>
    </div>
  );
}
