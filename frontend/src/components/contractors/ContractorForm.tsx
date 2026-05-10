"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import {
  contractorFormSchema,
  type ContractorFormPayload,
  type ContractorFormValues,
} from "@/lib/schemas/contractor";

type Props = {
  formId: string;
  defaultValues?: Partial<ContractorFormValues>;
  serverError?: string | null;
  onSubmit: (values: ContractorFormPayload) => void;
};

const SECTION_HEADING_CLASS =
  "mt-[18px] mb-[10px] flex items-center justify-between border-b border-[color:var(--orion-line-soft)] pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_LABEL_CLASS =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_INPUT_CLASS =
  "h-auto rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-[8px] text-[13px] text-[color:var(--orion-ink)] shadow-none focus-visible:border-[color:var(--brand-prod)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--brand-prod)_16%,transparent)] focus-visible:outline-none";

export function ContractorForm({ formId, defaultValues, serverError, onSubmit }: Props) {
  const t = useTranslations("contractors.form");
  const form = useForm<ContractorFormValues, unknown, ContractorFormPayload>({
    resolver: zodResolver(contractorFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      address: defaultValues?.address ?? "",
      phone: defaultValues?.phone ?? "",
    },
  });

  const errors = form.formState.errors;

  return (
    <form
      id={formId}
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col"
    >
      <div className={SECTION_HEADING_CLASS} style={{ marginTop: 0 }}>
        {t("sectionId")}
      </div>
      <div className="mb-[14px] flex flex-col gap-1.5">
        <label htmlFor={`${formId}-name`} className={FIELD_LABEL_CLASS}>
          {t("labels.name")}
        </label>
        <Input
          id={`${formId}-name`}
          autoComplete="off"
          aria-invalid={!!errors.name || !!serverError}
          placeholder={t("placeholders.name")}
          className={FIELD_INPUT_CLASS}
          {...form.register("name")}
        />
        {errors.name?.message ? (
          <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
            {t(errors.name.message as never)}
          </p>
        ) : null}
        {serverError && !errors.name ? (
          <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
            {serverError}
          </p>
        ) : null}
      </div>

      <div className={SECTION_HEADING_CLASS}>{t("sectionContact")}</div>
      <div className="mb-[14px] flex flex-col gap-1.5">
        <label htmlFor={`${formId}-address`} className={FIELD_LABEL_CLASS}>
          {t("labels.address")}
        </label>
        <Input
          id={`${formId}-address`}
          autoComplete="off"
          placeholder={t("placeholders.address")}
          className={FIELD_INPUT_CLASS}
          {...form.register("address")}
        />
      </div>
      <div className="mb-[14px] flex flex-col gap-1.5">
        <label htmlFor={`${formId}-phone`} className={FIELD_LABEL_CLASS}>
          {t("labels.phone")}
        </label>
        <Input
          id={`${formId}-phone`}
          autoComplete="off"
          placeholder={t("placeholders.phone")}
          className={FIELD_INPUT_CLASS}
          {...form.register("phone")}
        />
      </div>
    </form>
  );
}
