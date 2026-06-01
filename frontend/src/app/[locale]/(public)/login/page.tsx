"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Mail, Sparkles } from "lucide-react";
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
import { ProviderRow } from "@/components/auth/ProviderButtons";
import { BeltLoader, OrionMark, Wordmark } from "@/components/brand";
import { Link, useRouter } from "@/i18n/routing";
import { EMAIL_FOR_SIGN_IN_KEY, useAuth } from "@/providers/auth-provider";
import { isDevBypassEnabled } from "@/lib/firebase";

/**
 * Login screen — the floating-card constellation design.
 *
 * A single card floats over a faint Ember Orion-constellation watermark + a
 * soft accent glow, with the brand chip pinned top-left and a thin footer
 * below. It carries two modes:
 *
 * - "signin": providers (Google / Apple) + email & password + "forgot
 *   password". Invite-only — there is no self-service sign-up.
 * - "magic":  passwordless Firebase email-link sign-in. Sending emails a link;
 *   opening that link returns here and `completeEmailLink` finishes the login.
 *
 * Dev-bypass (NEXT_PUBLIC_DEV_BYPASS_AUTH): inputs are inert, a banner explains
 * the situation, and the primary action just routes to "/" (magic shows its
 * "sent" confirmation). After any real sign-in we push to "/"; the AppShell
 * then establishes the backend session or bounces uninvited emails to
 * /access-denied.
 */
const formSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type FormValues = z.infer<typeof formSchema>;
type Mode = "signin" | "magic";

const inputClasses =
  "h-auto w-full rounded-[9px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[13px] py-[11px] text-[14px] text-[color:var(--orion-ink)] shadow-none placeholder:text-[color:var(--orion-ink-3)] focus-visible:border-[color:var(--ember)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--ember)_16%,transparent)] focus-visible:outline-none";

const labelClasses =
  "text-[11.5px] font-semibold tracking-[0.1em] uppercase text-[color:var(--orion-ink-3)]";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const tAuth = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const {
    user,
    signInWithEmail,
    signInWithGoogle,
    signInWithApple,
    sendSignInLink,
    isEmailSignInLink,
    completeEmailLink,
  } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [showPw, setShowPw] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Magic-link sub-states.
  const [magicSent, setMagicSent] = useState(false);
  const [magicEmail, setMagicEmail] = useState("");
  // True while finishing a sign-in from an opened email link.
  const [completing, setCompleting] = useState(false);
  // The link was opened on a device without the stashed email — ask for it.
  const [confirmingLink, setConfirmingLink] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  // If we landed here via a Firebase email link, finish the sign-in. When the
  // address was stashed at request time we complete silently; otherwise we drop
  // into the "confirm your email" magic state so the user can re-enter it.
  useEffect(() => {
    if (isDevBypassEnabled) return;
    const href = window.location.href;
    if (!isEmailSignInLink(href)) return;
    const stored = window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
    if (!stored) {
      setMode("magic");
      setConfirmingLink(true);
      return;
    }
    setCompleting(true);
    completeEmailLink(stored, href)
      .then(() => router.push("/"))
      .catch(() => {
        setCompleting(false);
        setAuthError(t("errors.magicCompleteFailed"));
      });
    // Run once on mount; the auth helpers are stable callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function goTo(next: Mode) {
    setMode(next);
    setAuthError(null);
    setMagicSent(false);
    setConfirmingLink(false);
    form.clearErrors();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);

    // Dev-bypass honours the banner's promise: the primary action just enters.
    // For magic we still show the "sent" confirmation (inputs are inert, so we
    // fall back to the configured dev user's email) to demonstrate the flow.
    if (isDevBypassEnabled) {
      if (mode === "magic") {
        setMagicEmail(form.getValues("email") || user?.email || "");
        setMagicSent(true);
      } else {
        router.push("/");
      }
      return;
    }

    if (mode === "magic") {
      if (!(await form.trigger("email"))) return;
      const email = form.getValues("email");
      setSubmitting(true);
      try {
        if (confirmingLink) {
          await completeEmailLink(email, window.location.href);
          router.push("/");
        } else {
          await sendSignInLink(email, window.location.origin + window.location.pathname);
          setMagicEmail(email);
          setMagicSent(true);
        }
      } catch (err) {
        setAuthError(
          confirmingLink ? t("errors.magicCompleteFailed") : mapAuthError(err),
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Sign-in: validate the whole form (email + password) before submitting.
    if (!(await form.trigger())) return;
    const { email, password } = form.getValues();
    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
      router.push("/");
    } catch (err) {
      setAuthError(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function runProvider(fn: () => Promise<void>) {
    setAuthError(null);
    if (isDevBypassEnabled) {
      router.push("/");
      return;
    }
    setSubmitting(true);
    try {
      await fn();
      router.push("/");
    } catch (err) {
      setAuthError(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Head copy per state ──────────────────────────────────────────────
  let headTitle = t("title");
  let headSub: string | null = null;
  if (completing) {
    headTitle = t("magic.title");
  } else if (magicSent) {
    headTitle = t("magic.sentTitle");
  } else if (mode === "magic") {
    headTitle = t("magic.title");
    headSub = confirmingLink ? t("magic.confirmEmail") : t("magic.sub");
  }

  const devBanner = isDevBypassEnabled ? (
    <div
      role="status"
      className="flex items-start gap-2 rounded-[8px] border border-[color:color-mix(in_oklab,var(--status-warn)_25%,var(--orion-surface))] bg-[color:color-mix(in_oklab,var(--status-warn)_12%,var(--orion-surface))] px-3 py-2 text-[12.5px] leading-[1.4] text-[color:var(--status-warn)]"
    >
      <Sparkles className="mt-[2px] size-3.5 shrink-0" strokeWidth={1.75} />
      <span>{t("devBypassBanner")}</span>
    </div>
  ) : null;

  return (
    <>
      {/* Background: faint Ember accent glow + the Orion constellation traced as
          a t-shirt, sprawled behind the card. Clipped so it never scrolls. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 size-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in oklab, var(--ember) 9%, transparent) 0%, transparent 70%)",
          }}
        />
        <OrionMark
          variant="constellation"
          mono
          size={820}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[color:var(--ember)] opacity-[0.12]"
        />
      </div>

      {/* Brand chip — top-left. Product wordmark only; never a tenant name. */}
      <div className="fixed left-8 top-7 z-[2] inline-flex items-center gap-2.5 max-[540px]:left-5 max-[540px]:top-5">
        <OrionMark
          variant="constellation"
          mono
          size={30}
          className="text-[color:var(--ember)]"
        />
        <span className="flex flex-col gap-0.5 leading-none">
          <Wordmark size={17} className="text-[color:var(--orion-ink)]" />
          <span className="whitespace-nowrap text-[9.5px] font-medium uppercase tracking-[0.14em] text-[color:var(--orion-ink-3)]">
            {tAuth("brandTagline")}
          </span>
        </span>
      </div>

      {/* Floating card + footer, centered by the (public) layout. */}
      <div className="relative z-[1] flex w-full max-w-[480px] flex-col items-stretch">
        <div className="rounded-[18px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-11 pb-9 pt-10 shadow-[0_1px_0_rgba(255,255,255,.6)_inset,0_1px_2px_rgba(31,27,21,.04),0_18px_40px_-12px_rgba(31,27,21,.18),0_40px_80px_-24px_rgba(31,27,21,.22)] max-[540px]:px-6 max-[540px]:pb-7 max-[540px]:pt-8">
          <div className="flex flex-col gap-4">
            <header className="text-center">
              <h1 className="font-serif text-[26px] font-normal leading-[1.1] tracking-[-0.022em] text-[color:var(--orion-ink)]">
                {headTitle}
              </h1>
              {headSub ? (
                <p className="mt-1 text-[13.5px] leading-[1.45] text-[color:var(--orion-ink-3)]">
                  {headSub}
                </p>
              ) : null}
            </header>

            {completing ? (
              // ── Finishing an email-link sign-in ──
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <BeltLoader
                  size={48}
                  label={t("magic.completing")}
                  className="text-[color:var(--ember)]"
                />
                <p className="text-[13.5px] text-[color:var(--orion-ink-3)]">
                  {t("magic.completing")}
                </p>
              </div>
            ) : magicSent ? (
              // ── "Check your email" confirmation ──
              <div className="flex flex-col gap-5 text-center">
                <div className="mx-auto grid size-12 place-items-center rounded-full bg-[color:color-mix(in_oklab,var(--ember)_12%,var(--orion-surface))] text-[color:var(--ember)]">
                  <Mail className="size-5" strokeWidth={1.75} />
                </div>
                <p className="text-[13.5px] leading-[1.5] text-[color:var(--orion-ink-2)]">
                  {t("magic.sentBody", { email: magicEmail })}
                </p>
                <button
                  type="button"
                  onClick={() => goTo("signin")}
                  className="inline-flex items-center justify-center gap-1.5 text-[13px] font-medium text-[color:var(--ember)] hover:underline"
                >
                  <ArrowLeft className="size-3.5" strokeWidth={2} />
                  {t("backToSignIn")}
                </button>
              </div>
            ) : (
              // ── Sign-in & magic-request forms ──
              <Form {...form}>
                <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
                  {devBanner}

                  {mode === "signin" ? (
                    <>
                      <ProviderRow
                        onGoogle={() => runProvider(signInWithGoogle)}
                        onApple={() => runProvider(signInWithApple)}
                        disabled={submitting}
                      />
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <span className="h-px bg-[color:var(--orion-line)]" />
                        <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-[color:var(--orion-ink-3)]">
                          {t("providerDivider")}
                        </span>
                        <span className="h-px bg-[color:var(--orion-line)]" />
                      </div>
                    </>
                  ) : null}

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="gap-1.5">
                        <FormLabel className={labelClasses}>{tAuth("email")}</FormLabel>
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

                  {mode === "signin" ? (
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem className="gap-1.5">
                          <div className="flex items-baseline justify-between gap-3">
                            <FormLabel className={labelClasses}>
                              {tAuth("password")}
                            </FormLabel>
                            <Link
                              href="/forgot-password"
                              className="whitespace-nowrap text-[11.5px] font-medium text-[color:var(--ember)] hover:underline"
                            >
                              {t("forgotPassword")}
                            </Link>
                          </div>
                          <FormControl>
                            <div className="relative flex">
                              <Input
                                {...field}
                                type={showPw ? "text" : "password"}
                                autoComplete="current-password"
                                placeholder="••••••••"
                                className={`${inputClasses} pr-10`}
                                disabled={isDevBypassEnabled || submitting}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPw((v) => !v)}
                                aria-label={
                                  showPw ? tAuth("hidePassword") : tAuth("showPassword")
                                }
                                className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-[6px] text-[color:var(--orion-ink-3)] hover:bg-[color:var(--orion-surface-2)] hover:text-[color:var(--orion-ink)]"
                              >
                                {showPw ? (
                                  <EyeOff className="size-[15px]" strokeWidth={1.75} />
                                ) : (
                                  <Eye className="size-[15px]" strokeWidth={1.75} />
                                )}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage className="text-[11.5px]" />
                        </FormItem>
                      )}
                    />
                  ) : null}

                  {authError ? (
                    <p role="alert" className="text-[12px] text-[color:var(--status-err)]">
                      {authError}
                    </p>
                  ) : null}

                  {/* Primary submit — ink button with a sliding arrow. */}
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="group mt-1 h-auto w-full justify-center gap-2 rounded-[10px] py-[13px] text-[14px] font-medium tracking-[0.01em] shadow-[0_1px_0_rgba(255,255,255,.08)_inset,0_6px_18px_-8px_rgba(31,27,21,.4)] hover:bg-[color:color-mix(in_oklab,var(--orion-ink)_90%,var(--ember))]"
                  >
                    <span>
                      {mode === "magic"
                        ? submitting
                          ? t("magic.sending")
                          : confirmingLink
                            ? t("magic.finish")
                            : t("magic.submit")
                        : submitting
                          ? t("submitting")
                          : t("submit")}
                    </span>
                    <ArrowRight
                      className="size-4 transition-transform group-hover:translate-x-0.5"
                      strokeWidth={2}
                    />
                  </Button>

                  {mode === "signin" ? (
                    // Magic-link — equal-weight secondary action.
                    <button
                      type="button"
                      onClick={() => goTo("magic")}
                      className="inline-flex w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-[10px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[18px] py-3 text-[13.5px] font-medium text-[color:var(--orion-ink)] transition-colors hover:border-[color:color-mix(in_oklab,var(--ember)_35%,var(--orion-line))] hover:bg-[color:color-mix(in_oklab,var(--ember)_6%,var(--orion-surface))] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--ember)_20%,transparent)]"
                    >
                      <Sparkles className="size-[15px] text-[color:var(--ember)]" strokeWidth={1.75} />
                      <span>{t("magicCta")}</span>
                    </button>
                  ) : (
                    <div className="mt-1 border-t border-[color:var(--orion-line-soft)] pt-4 text-center">
                      <button
                        type="button"
                        onClick={() => goTo("signin")}
                        className="inline-flex items-center justify-center gap-1.5 text-[13px] font-medium text-[color:var(--ember)] hover:underline"
                      >
                        <ArrowLeft className="size-3.5" strokeWidth={2} />
                        {t("backToSignIn")}
                      </button>
                    </div>
                  )}
                </form>
              </Form>
            )}
          </div>
        </div>

        {/* Page footer — legal + locale. Links are placeholders until those
            pages exist. */}
        <footer className="mt-7 flex flex-wrap items-center justify-center gap-2.5 text-[11.5px] text-[color:var(--orion-ink-3)]">
          <button type="button" className="hover:text-[color:var(--orion-ink)] hover:underline">
            {tAuth("footer.terms")}
          </button>
          <span className="opacity-50">·</span>
          <button type="button" className="hover:text-[color:var(--orion-ink)] hover:underline">
            {tAuth("footer.privacy")}
          </button>
          <span className="opacity-50">·</span>
          <button type="button" className="hover:text-[color:var(--orion-ink)] hover:underline">
            {tAuth("footer.support")}
          </button>
          <span className="ml-1.5 rounded-full border border-[color:var(--orion-line)] px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em]">
            {locale}
          </span>
        </footer>
      </div>
    </>
  );
}
