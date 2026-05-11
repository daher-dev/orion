"use client";

import { useState, use } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/components/auth/AuthCard";
import { Link, useRouter } from "@/i18n/routing";
import { useAcceptInvite, useInvite } from "@/hooks/use-onboarding";
import { ApiError } from "@/lib/api-client";

/**
 * Accept-invite page (`/accept-invite/[token]`).
 *
 * Three render states:
 *  1. Loading — invite metadata is being fetched.
 *  2. Invalid — backend returned 404/410 (expired or already accepted); we
 *     surface the matching translated message + a link back to /login.
 *  3. Valid — the user sees the company + role and a primary "Accept and sign
 *     in" button. The button calls POST /accept and on success pushes to "/".
 *
 * The token is a Next.js dynamic route param. We use React.use to unwrap the
 * Next 16 promise-shaped params correctly.
 */
type InvitePageProps = {
  params: Promise<{ token: string; locale: string }>;
};

export default function AcceptInvitePage({ params }: InvitePageProps) {
  const { token } = use(params);
  const t = useTranslations("auth.acceptInvite");
  const router = useRouter();
  const { data, isPending, isError, error } = useInvite(token);
  const acceptMutation = useAcceptInvite(token);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  function inviteErrorMessage(err: ApiError | null | undefined): string {
    if (!err) return t("errors.generic");
    if (err.status === 404) return t("errors.invalid");
    if (err.status === 410) return t("errors.expired");
    if (err.status === 409) return t("errors.alreadyAccepted");
    const detail = (err.detail ?? "").toLowerCase();
    if (detail.includes("expired")) return t("errors.expired");
    if (detail.includes("accepted")) return t("errors.alreadyAccepted");
    return t("errors.invalid");
  }

  async function handleAccept() {
    setAcceptError(null);
    try {
      await acceptMutation.mutateAsync({});
      toast.success(t("title"));
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError) {
        setAcceptError(inviteErrorMessage(err));
      } else {
        setAcceptError(t("errors.generic"));
      }
    }
  }

  if (isPending) {
    return (
      <AuthCard title={t("title")} sub={t("loading")}>
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-9" />
        </div>
      </AuthCard>
    );
  }

  if (isError || !data) {
    return (
      <AuthCard
        title={t("title")}
        sub={inviteErrorMessage(error as ApiError | null | undefined)}
      >
        <Link
          href="/login"
          className="self-start text-[13px] font-medium text-[color:var(--ring)] hover:underline"
        >
          {t("backToLogin")}
        </Link>
      </AuthCard>
    );
  }

  // Valid invite — show company + role and the accept button.
  return (
    <AuthCard title={t("title")}>
      <p
        className="text-[14px] leading-[1.55] text-[color:var(--orion-ink-2)]"
        // The translated body uses <strong>…</strong> to emphasize the
        // company and role names — `rich` would be overkill here, plain
        // substitution + dangerously is fine because both variables come
        // straight from the backend (already escaped at the DB layer).
        dangerouslySetInnerHTML={{
          __html: t("body", {
            companyName: escapeHtml(data.company_name),
            roleName: escapeHtml(data.role_name),
          }),
        }}
      />

      {acceptError ? (
        <p role="alert" className="text-[12px] text-[color:var(--status-err)]">
          {acceptError}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 pt-1">
        <Button
          type="button"
          onClick={handleAccept}
          disabled={acceptMutation.isPending}
          className="h-auto w-full justify-center gap-[7px] rounded-[6px] border bg-[#2563eb] !px-[13px] py-[9px] text-[13.5px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95 focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,#2563eb_28%,transparent)] focus-visible:outline-none"
          style={{ borderColor: "color-mix(in oklab, #2563eb 70%, black)" }}
        >
          {acceptMutation.isPending ? t("accepting") : t("accept")}
        </Button>
        <Link
          href="/login"
          className="self-center text-[12.5px] text-[color:var(--orion-ink-3)] hover:underline"
        >
          {t("decline")}
        </Link>
      </div>
    </AuthCard>
  );
}

/**
 * Minimal HTML escape — only the five characters that change a parsed token
 * inside the `<strong>` wrapper. The translation key controls the wrapper
 * itself, the values are user-controlled (company name from the DB) so we
 * sanitize them defensively even though SQL/Pydantic already constrain
 * input.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
