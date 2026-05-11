"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { AuthCard } from "@/components/auth/AuthCard";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { Link, useRouter } from "@/i18n/routing";
import { useAuth } from "@/providers/auth-provider";
import { isDevBypassEnabled } from "@/lib/firebase";

/**
 * Login screen.
 *
 * Sign-in modes:
 * - Dev-bypass (NEXT_PUBLIC_DEV_BYPASS_AUTH=true): inputs are inert, a banner
 *   explains the situation, and "Entrar" just pushes the router to "/" — the
 *   AppShell + dev-bypass user takes over from there.
 * - Real Firebase: email/password via signInWithEmailAndPassword and Google
 *   via signInWithPopup. Errors are translated, no raw Firebase messages bleed
 *   through.
 *
 * After a successful sign-in we push to "/". The AppShell will then either
 * render the dashboard or redirect to "/onboarding" depending on whether the
 * user has a Company row yet.
 */
const formSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type FormValues = z.infer<typeof formSchema>;

const inputClasses =
  "h-[36px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-2 text-[13.5px] text-[color:var(--orion-ink)] shadow-none placeholder:text-[color:var(--orion-ink-3)] focus-visible:border-[color:var(--ring)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--ring)_18%,transparent)] focus-visible:outline-none";

const labelClasses =
  "text-[11.5px] font-semibold tracking-[0.08em] uppercase text-[color:var(--orion-ink-3)]";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  function mapAuthError(err: unknown): string {
    const code =
      err && typeof err === "object" && "code" in err && typeof err.code === "string"
        ? err.code
        : "";
    if (code === "auth/popup-blocked") return t("errors.popupBlocked");
    if (
      code === "auth/invalid-credential" ||
      code === "auth/invalid-email" ||
      code === "auth/wrong-password" ||
      code === "auth/user-not-found"
    ) {
      return t("errors.invalidCredentials");
    }
    return t("errors.generic");
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setAuthError(null);
    setSubmitting(true);
    try {
      if (isDevBypassEnabled) {
        // Dev-bypass: signInWithEmail is a no-op, just route to "/".
        router.push("/");
        return;
      }
      await signInWithEmail(values.email, values.password);
      router.push("/");
    } catch (err) {
      setAuthError(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  });

  async function handleGoogle() {
    setAuthError(null);
    setSubmitting(true);
    try {
      if (isDevBypassEnabled) {
        router.push("/");
        return;
      }
      await signInWithGoogle();
      router.push("/");
    } catch (err) {
      setAuthError(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title={t("title")}
      sub={t("sub")}
      banner={
        isDevBypassEnabled ? (
          <div
            role="status"
            // Soft warning pill — uses --status-warn so it blends with the
            // warm palette but is still recognisably "heads-up".
            className="flex items-start gap-2 rounded-[6px] border border-[color:color-mix(in_oklab,var(--status-warn)_25%,var(--orion-surface))] bg-[color:color-mix(in_oklab,var(--status-warn)_12%,var(--orion-surface))] px-3 py-2 text-[12.5px] leading-[1.4] text-[color:var(--status-warn)]"
          >
            <Sparkles className="mt-[2px] size-3.5 shrink-0" strokeWidth={1.75} />
            <span>{t("devBypassBanner")}</span>
          </div>
        ) : null
      }
    >
      <Form {...form}>
        <form onSubmit={onSubmit} className="flex flex-col gap-3.5" noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="gap-1.5">
                <FormLabel className={labelClasses}>
                  {tAuth("email")}
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    className={inputClasses}
                    disabled={isDevBypassEnabled || submitting}
                  />
                </FormControl>
                <FormMessage className="text-[11.5px]" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <FormLabel className={labelClasses}>
                    {tAuth("password")}
                  </FormLabel>
                  <Link
                    href="/forgot-password"
                    className="text-[11.5px] font-medium text-[color:var(--ring)] hover:underline"
                  >
                    {t("forgotPassword")}
                  </Link>
                </div>
                <FormControl>
                  <Input
                    {...field}
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className={inputClasses}
                    disabled={isDevBypassEnabled || submitting}
                  />
                </FormControl>
                <FormMessage className="text-[11.5px]" />
              </FormItem>
            )}
          />

          {authError ? (
            <p
              role="alert"
              className="text-[12px] text-[color:var(--status-err)]"
            >
              {authError}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={submitting}
            // .btn-primary — accent indigo bg, white text, 7×13 padding, 6px
            // radius, inset + outer shadow, accent-edge border.
            className="h-auto w-full justify-center gap-[7px] rounded-[6px] border bg-[#2563eb] !px-[13px] py-[9px] text-[13.5px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95 focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,#2563eb_28%,transparent)] focus-visible:outline-none"
            style={{ borderColor: "color-mix(in oklab, #2563eb 70%, black)" }}
          >
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </form>
      </Form>

      <div className="relative flex items-center gap-3">
        <span className="h-px flex-1 bg-[color:var(--orion-line-soft)]" />
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[color:var(--orion-ink-3)]">
          {/* Inline mini-divider label — keeps the "or" out of i18n on purpose;
              it's a visual separator, not microcopy. */}
          ·
        </span>
        <span className="h-px flex-1 bg-[color:var(--orion-line-soft)]" />
      </div>

      <GoogleButton onClick={handleGoogle} disabled={submitting} />

      <div className="flex items-center justify-center gap-1.5 pt-1 text-[12.5px] text-[color:var(--orion-ink-3)]">
        <span>{t("noAccount")}</span>
        <Link
          href="/signup"
          className="font-medium text-[color:var(--ring)] hover:underline"
        >
          {t("createAccount")}
        </Link>
      </div>
    </AuthCard>
  );
}
