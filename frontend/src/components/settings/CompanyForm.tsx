"use client";

import { Download, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyCompany, useUpdateCompany } from "@/hooks/use-company";
import { useCanAccess } from "@/hooks/use-permissions";
import { colorPresets, hexColorRegex } from "@/lib/schemas/company";

type FormValues = {
  name: string;
  main_color: string;
};

const FIELD_LABEL_CLASS =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_INPUT_CLASS =
  "h-auto rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-[8px] text-[13px] text-[color:var(--orion-ink)] shadow-none focus-visible:border-[color:var(--brand-settings)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--brand-settings)_16%,transparent)] focus-visible:outline-none";
const CARD_CLASS =
  "overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]";
const CARD_HEAD_CLASS =
  "flex items-center justify-between gap-3 border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]";
const SECONDARY_BTN_CLASS =
  "inline-flex h-auto items-center gap-[7px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] hover:bg-[color:var(--orion-surface-2)]";

export function CompanyForm() {
  const t = useTranslations("settings.company");
  const tPresets = useTranslations("settings.colorPresets");
  const tForbidden = useTranslations("settings.forbidden");
  const canRead = useCanAccess("companies.read");
  const canWrite = useCanAccess("companies.write");

  const { data, isPending, isError, error } = useMyCompany();
  const updateCompany = useUpdateCompany();

  const form = useForm<FormValues>({
    // Pulling from `data` via `values` keeps the form synced with the server
    // response — no extra useEffect/setState needed when /me refetches.
    values: data ? { name: data.name, main_color: data.main_color } : undefined,
    defaultValues: { name: "", main_color: "" },
  });
  // Live values drive the swatch highlight + the "displayed as" helper —
  // read directly from RHF so there's no parallel state to keep in sync.
  const selectedColor = form.watch("main_color");
  const watchedName = form.watch("name");

  if (!canRead) {
    return (
      <div className={`${CARD_CLASS} px-6 py-10 text-center text-[color:var(--orion-ink-3)]`}>
        {tForbidden("company")}
      </div>
    );
  }

  if (isPending) {
    return (
      <div className={`${CARD_CLASS} p-5`}>
        <div className="space-y-3">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-9" />
          <Skeleton className="h-9 w-1/3" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={`${CARD_CLASS} px-6 py-10 text-center text-[color:var(--orion-ink-3)]`}>
        {error?.detail ?? "Error"}
      </div>
    );
  }

  const handleSubmit = form.handleSubmit(async (values) => {
    const name = values.name.trim();
    const color = selectedColor ?? values.main_color;

    if (!name) {
      form.setError("name", { message: t("validation.nameRequired") });
      return;
    }
    if (!hexColorRegex.test(color)) {
      toast.error(t("validation.colorInvalid"));
      return;
    }

    const payload: Record<string, string> = {};
    if (name !== data.name) payload.name = name;
    if (color !== data.main_color) payload.main_color = color;

    if (Object.keys(payload).length === 0) {
      // No changes — silent no-op rather than fire an empty PATCH.
      toast.success(t("savedToast"));
      return;
    }

    try {
      await updateCompany.mutateAsync(payload);
      toast.success(t("savedToast"));
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      toast.error(t("errorToast"), detail ? { description: detail } : undefined);
    }
  });

  // "Displayed as 'X by Orion'" — live preview of the company name as it
  // would read in the sidebar/auth cards. Falls back to the persisted name
  // while the input is empty so the helper never collapses.
  const displayedName = watchedName?.trim() || data.name;
  const comingSoon = () => toast.message(t("dangerZone.comingSoonToast"));

  return (
    // .settings-grid right pane — a 18px vertical stack of cards.
    // Matches `<div style={{display: 'grid', gap: 18}}>` from
    // /docs/design/source/pages/settings.jsx > CompanyPane.
    <div className="grid gap-[18px]">
      <div className={CARD_CLASS}>
        {/* .card-head — 14 18 padding, line-soft border-b. */}
        <div className={CARD_HEAD_CLASS}>
          <div>
            <div className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
              {t("title")}
            </div>
            <div className="mt-0.5 text-[12px] text-[color:var(--orion-ink-3)]">
              {t("sub")}
            </div>
          </div>
        </div>

        {/* .card-pad — 14 18 18 from the design source `pad`. */}
        <form
          data-testid="company-form"
          onSubmit={handleSubmit}
          noValidate
          className="grid gap-[18px] px-[18px] pt-[14px] pb-[18px]"
        >
          <div className="grid gap-[16px] md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="company-name" className={FIELD_LABEL_CLASS}>
                {t("labels.name")}
              </label>
              <Input
                id="company-name"
                autoComplete="off"
                aria-invalid={!!form.formState.errors.name}
                disabled={!canWrite}
                className={FIELD_INPUT_CLASS}
                {...form.register("name")}
              />
              {/* "Displayed as 'X by Orion'" helper from the design — gives
                  the user a live preview of how the brand wordmark will read
                  in the sidebar + auth surfaces. */}
              <p className="text-[11px] text-[color:var(--orion-ink-3)]">
                {t.rich("helpers.displayedAs", {
                  name: displayedName,
                  b: (chunks) => (
                    <b className="font-medium text-[color:var(--orion-ink-2)]">{chunks}</b>
                  ),
                })}
              </p>
              {form.formState.errors.name?.message ? (
                <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
                  {form.formState.errors.name.message}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="company-subdomain" className={FIELD_LABEL_CLASS}>
                {t("labels.subdomain")}
              </label>
              <Input
                id="company-subdomain"
                value={data.subdomain}
                readOnly
                disabled
                className={`${FIELD_INPUT_CLASS} cursor-not-allowed opacity-70`}
              />
              <p className="text-[11px] italic text-[color:var(--orion-ink-3)]">
                {t("helpers.subdomainImmutable")}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className={FIELD_LABEL_CLASS}>{t("labels.mainColor")}</label>
            <div className="flex flex-wrap gap-2">
              {colorPresets.map((preset) => {
                const active = selectedColor?.toLowerCase() === preset.hex.toLowerCase();
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-label={tPresets(preset.id)}
                    aria-pressed={active}
                    data-color={preset.id}
                    data-active={active || undefined}
                    disabled={!canWrite}
                    onClick={() =>
                      form.setValue("main_color", preset.hex, { shouldDirty: true })
                    }
                    // Design: 36×36 rounded-8 swatch buttons. Active gets 2px
                    // surface ring + 4px brand ring.
                    className="size-9 rounded-lg border-0 transition-shadow data-[active]:shadow-[0_0_0_2px_var(--orion-surface),0_0_0_4px_currentColor] disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      background: preset.hex,
                      color: preset.hex,
                    }}
                  />
                );
              })}
            </div>
            {/* "Aparece na sidebar, nos botões primários e nos relatórios em
                PDF." — copy from /docs/design/source/pages/settings.jsx. */}
            <p className="mt-1 text-[11px] text-[color:var(--orion-ink-3)]">
              {t("helpers.colorAppliedTo")}
            </p>
          </div>

          {canWrite ? (
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={updateCompany.isPending}
                className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-settings)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
                style={{
                  borderColor: "color-mix(in oklab, var(--brand-settings) 70%, black)",
                }}
              >
                {t("save")}
              </Button>
            </div>
          ) : null}
        </form>
      </div>

      {/* Zona crítica — direct port of the second Card in CompanyPane
          (/docs/design/source/pages/settings.jsx). Two rows separated by a
          .line-soft hairline; the delete action is rendered in `--status-err`. */}
      {canWrite ? (
        <div className={CARD_CLASS}>
          <div className={CARD_HEAD_CLASS}>
            <div>
              <div className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
                {t("dangerZone.title")}
              </div>
              <div className="mt-0.5 text-[12px] text-[color:var(--orion-ink-3)]">
                {t("dangerZone.sub")}
              </div>
            </div>
          </div>
          <div className="px-[18px] pt-[14px] pb-[18px]">
            <div className="flex items-center justify-between gap-3 py-1">
              <div>
                <div className="text-[13.5px] font-medium text-[color:var(--orion-ink)]">
                  {t("dangerZone.export.title")}
                </div>
                <div className="mt-0.5 text-[12px] text-[color:var(--orion-ink-3)]">
                  {t("dangerZone.export.body")}
                </div>
              </div>
              <button type="button" onClick={comingSoon} className={SECONDARY_BTN_CLASS}>
                <Download className="size-[13px]" strokeWidth={1.8} aria-hidden />
                <span>{t("dangerZone.export.action")}</span>
              </button>
            </div>

            <div className="my-3 h-px bg-[color:var(--orion-line-soft)]" />

            <div className="flex items-center justify-between gap-3 py-1">
              <div>
                <div className="text-[13.5px] font-medium text-[color:var(--status-err)]">
                  {t("dangerZone.delete.title")}
                </div>
                <div className="mt-0.5 text-[12px] text-[color:var(--orion-ink-3)]">
                  {t("dangerZone.delete.body")}
                </div>
              </div>
              <button
                type="button"
                onClick={comingSoon}
                className={SECONDARY_BTN_CLASS}
                style={{
                  color: "var(--status-err)",
                  borderColor:
                    "color-mix(in oklab, var(--status-err) 30%, var(--orion-line))",
                }}
              >
                <Trash2 className="size-[13px]" strokeWidth={1.8} aria-hidden />
                <span>{t("dangerZone.delete.action")}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
