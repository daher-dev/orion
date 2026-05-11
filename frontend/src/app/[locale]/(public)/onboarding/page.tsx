"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
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
import { PresetColorPicker } from "@/components/auth/PresetColorPicker";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/providers/auth-provider";
import { useCreateOnboardingCompany } from "@/hooks/use-onboarding";
import { deriveSubdomain } from "@/lib/subdomain";
import { ApiError } from "@/lib/api-client";

/**
 * Onboarding wizard — single-step in v1.
 *
 * Flow: user fills company name + (auto-derived) subdomain + picks a brand
 * color. On submit we POST `/v1/auth/onboarding/companies`. On success we
 * invalidate `useMe` (done by the hook) and push to "/" — the AppShell then
 * sees the new Company row and renders the dashboard.
 *
 * Subdomain handling: we auto-derive from the company name until the user
 * manually edits the subdomain field. Once they do, we stop overwriting it so
 * their intent is preserved.
 *
 * Guards: if `useAuth().user` is null we redirect to /login. We don't gate on
 * `useMe()` here because the AppShell already routes "no user row" users to
 * this page — that path is the entire reason this page exists.
 */
const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

type FormValues = {
  company_name: string;
  subdomain: string;
  main_color: string;
};

const inputClasses =
  "h-[36px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-2 text-[13.5px] text-[color:var(--orion-ink)] shadow-none placeholder:text-[color:var(--orion-ink-3)] focus-visible:border-[color:var(--ring)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--ring)_18%,transparent)] focus-visible:outline-none";

const labelClasses =
  "text-[11.5px] font-semibold tracking-[0.08em] uppercase text-[color:var(--orion-ink-3)]";

export default function OnboardingPage() {
  const t = useTranslations("auth.onboarding");
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const createCompany = useCreateOnboardingCompany();

  const [subdomainEdited, setSubdomainEdited] = useState(false);

  const formSchema = z.object({
    company_name: z.string().min(1, { message: t("validation.nameRequired") }).max(120),
    subdomain: z
      .string()
      .min(1, { message: t("validation.subdomainRequired") })
      .max(63)
      .regex(SUBDOMAIN_RE, { message: t("validation.subdomainSlug") }),
    main_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      company_name: "",
      subdomain: "",
      main_color: "#2563eb",
    },
    mode: "onSubmit",
  });

  // Auth guard. Hitting /onboarding while signed out → redirect to /login.
  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  // Subdomain auto-derivation. Watch the company_name field; only sync the
  // subdomain while the user hasn't touched it manually.
  const watchedName = form.watch("company_name");
  useEffect(() => {
    if (subdomainEdited) return;
    const derived = deriveSubdomain(watchedName);
    if (form.getValues("subdomain") !== derived) {
      form.setValue("subdomain", derived, { shouldValidate: false });
    }
  }, [watchedName, subdomainEdited, form]);

  const selectedColor = form.watch("main_color");

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createCompany.mutateAsync({
        company_name: values.company_name.trim(),
        subdomain: values.subdomain.trim().toLowerCase(),
        main_color: values.main_color,
      });
      toast.success(t("toasts.created"));
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        form.setError("subdomain", {
          type: "manual",
          message: t("validation.subdomainTaken"),
        });
        return;
      }
      toast.error(t("toasts.error"));
    }
  });

  // While the auth guard runs we don't render the wizard — keeps it from
  // flashing for sign-out users on their way to /login.
  if (!authLoading && !user) return null;

  return (
    <AuthCard title={t("title")} sub={t("sub")}>
      <Form {...form}>
        <form onSubmit={onSubmit} className="flex flex-col gap-3.5" noValidate>
          <FormField
            control={form.control}
            name="company_name"
            render={({ field }) => (
              <FormItem className="gap-1.5">
                <FormLabel className={labelClasses}>{t("labels.companyName")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    autoFocus
                    placeholder={t("placeholders.companyName")}
                    autoComplete="organization"
                    className={inputClasses}
                  />
                </FormControl>
                <FormMessage className="text-[11.5px]" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="subdomain"
            render={({ field }) => (
              <FormItem className="gap-1.5">
                <FormLabel className={labelClasses}>{t("labels.subdomain")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t("placeholders.subdomain")}
                    autoComplete="off"
                    spellCheck={false}
                    className={`${inputClasses} font-mono`}
                    onChange={(e) => {
                      setSubdomainEdited(true);
                      field.onChange(e.target.value.toLowerCase());
                    }}
                  />
                </FormControl>
                <p className="text-[11px] italic text-[color:var(--orion-ink-3)]">
                  {t("helpers.subdomainDerivation")}
                </p>
                <FormMessage className="text-[11.5px]" />
              </FormItem>
            )}
          />

          <PresetColorPicker
            value={selectedColor}
            onChange={(hex) =>
              form.setValue("main_color", hex, { shouldDirty: true })
            }
            label={t("labels.mainColor")}
            labelId="main-color-label"
            disabled={createCompany.isPending}
          />

          <Button
            type="submit"
            disabled={createCompany.isPending}
            className="mt-2 h-auto w-full justify-center gap-[7px] rounded-[6px] border bg-[#2563eb] !px-[13px] py-[9px] text-[13.5px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95 focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,#2563eb_28%,transparent)] focus-visible:outline-none"
            style={{
              background: selectedColor,
              borderColor: `color-mix(in oklab, ${selectedColor} 70%, black)`,
            }}
          >
            {createCompany.isPending ? t("submitting") : t("submit")}
          </Button>
        </form>
      </Form>
    </AuthCard>
  );
}
