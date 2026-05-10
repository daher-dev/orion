"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { ClientCreate, ClientRead } from "@/lib/schemas/client";

/**
 * Form fields use the design's `.field` rhythm:
 *   label: 11.5px uppercase tracking .08em weight 600 ink-3
 *   input: 8px 11px padding, surface bg, 6px radius, 1px line border
 */

const buildFormSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(1, { message: t("validation.nameRequired") }),
    email: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((v) => v ?? "")
      .refine((v) => v === "" || z.email().safeParse(v).success, {
        message: t("validation.emailInvalid"),
      }),
    phone: z.string().optional().or(z.literal("")),
    address: z.string().optional().or(z.literal("")),
  });

export type ClientFormValues = {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
};

const inputClasses =
  "h-[34px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-2 text-[13px] text-[color:var(--orion-ink)] shadow-none placeholder:text-[color:var(--orion-ink-3)] focus-visible:border-[color:var(--ring)] focus-visible:ring-0";

const labelClasses =
  "text-[11.5px] font-semibold tracking-[0.08em] uppercase text-[color:var(--orion-ink-3)]";

const sectionTitleClasses =
  "mb-2.5 border-b border-[color:var(--orion-line-soft)] pb-2 text-[11px] font-semibold tracking-[0.08em] uppercase text-[color:var(--orion-ink-3)]";

export type ClientFormProps = {
  formId: string;
  initial?: ClientRead;
  onSubmit: (values: ClientCreate) => Promise<void> | void;
};

export function ClientForm({ formId, initial, onSubmit }: ClientFormProps) {
  const t = useTranslations("clients.form");
  const schema = buildFormSchema((key) => t(key));
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      email: initial?.email ?? "",
      phone: initial?.phone ?? "",
      address: initial?.address ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      name: initial?.name ?? "",
      email: initial?.email ?? "",
      phone: initial?.phone ?? "",
      address: initial?.address ?? "",
    });
  }, [initial, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const payload: ClientCreate = {
      name: values.name.trim(),
      email: values.email && values.email.length > 0 ? values.email : undefined,
      phone: values.phone && values.phone.length > 0 ? values.phone : undefined,
      address: values.address && values.address.length > 0 ? values.address : undefined,
    };
    await onSubmit(payload);
  });

  return (
    <Form {...form}>
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-[22px]">
        <div>
          <div className={sectionTitleClasses}>{t("sections.identity")}</div>
          <div className="grid gap-3.5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="gap-1.5">
                  <FormLabel className={labelClasses}>{t("labels.name")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("placeholders.name")}
                      className={inputClasses}
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage className="text-[11.5px]" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="gap-1.5">
                  <FormLabel className={labelClasses}>{t("labels.address")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("placeholders.address")}
                      className={inputClasses}
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage className="text-[11.5px]" />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div>
          <div className={sectionTitleClasses}>{t("sections.contact")}</div>
          <div className="grid gap-3.5">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="gap-1.5">
                  <FormLabel className={labelClasses}>{t("labels.email")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder={t("placeholders.email")}
                      className={inputClasses}
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage className="text-[11.5px]" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem className="gap-1.5">
                  <FormLabel className={labelClasses}>{t("labels.phone")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("placeholders.phone")}
                      className={inputClasses}
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage className="text-[11.5px]" />
                </FormItem>
              )}
            />
          </div>
        </div>
      </form>
    </Form>
  );
}
