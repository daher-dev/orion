"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyUser, useUpdateUserSelf } from "@/hooks/use-user";
import { useCanAccess } from "@/hooks/use-permissions";

type FormValues = {
  name: string;
  job: string;
};

const FIELD_LABEL_CLASS =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_INPUT_CLASS =
  "h-auto rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-[8px] text-[13px] text-[color:var(--orion-ink)] shadow-none focus-visible:border-[color:var(--brand-settings)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--brand-settings)_16%,transparent)] focus-visible:outline-none";

export function ProfileForm() {
  const t = useTranslations("settings.profile");

  const { data, isPending, isError, error } = useMyUser();
  const updateUserSelf = useUpdateUserSelf();
  // Admins manage roles on Settings → Members, not on their own profile (you
  // can't change your own role here either way — a self-demotion guard). Show
  // them a useful pointer instead of the generic "ask an administrator" nag.
  const canManageRoles = useCanAccess("users.write");

  const form = useForm<FormValues>({
    defaultValues: { name: "", job: "" },
  });

  useEffect(() => {
    if (data) {
      form.reset({ name: data.name, job: data.job ?? "" });
    }
  }, [data, form]);

  if (isPending) {
    return (
      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-5">
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
      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-6 py-10 text-center text-[color:var(--orion-ink-3)]">
        {error?.detail ?? "Error"}
      </div>
    );
  }

  const handleSubmit = form.handleSubmit(async (values) => {
    const name = values.name.trim();
    const job = values.job.trim();

    if (!name) {
      form.setError("name", { message: t("validation.nameRequired") });
      return;
    }

    const payload: Record<string, string> = {};
    if (name !== data.name) payload.name = name;
    if (job !== (data.job ?? "")) payload.job = job;

    if (Object.keys(payload).length === 0) {
      toast.success(t("savedToast"));
      return;
    }

    try {
      await updateUserSelf.mutateAsync(payload);
      toast.success(t("savedToast"));
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      toast.error(t("errorToast"), detail ? { description: detail } : undefined);
    }
  });

  return (
    <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]">
        <div>
          <div className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {t("title")}
          </div>
          <div className="mt-0.5 text-[12px] text-[color:var(--orion-ink-3)]">
            {t("sub")}
          </div>
        </div>
      </div>

      <form
        data-testid="profile-form"
        onSubmit={handleSubmit}
        noValidate
        className="grid gap-[18px] px-5 py-[18px]"
      >
        <div className="grid gap-[16px] md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="profile-name" className={FIELD_LABEL_CLASS}>
              {t("labels.name")}
            </label>
            <Input
              id="profile-name"
              autoComplete="off"
              aria-invalid={!!form.formState.errors.name}
              className={FIELD_INPUT_CLASS}
              {...form.register("name")}
            />
            {form.formState.errors.name?.message ? (
              <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="profile-email" className={FIELD_LABEL_CLASS}>
              {t("labels.email")}
            </label>
            <Input
              id="profile-email"
              value={data.email}
              readOnly
              disabled
              className={`${FIELD_INPUT_CLASS} cursor-not-allowed opacity-70`}
            />
            <p className="text-[11px] italic text-[color:var(--orion-ink-3)]">
              {t("helpers.emailImmutable")}
            </p>
          </div>
        </div>

        <div className="grid gap-[16px] md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="profile-job" className={FIELD_LABEL_CLASS}>
              {t("labels.job")}
            </label>
            <Input
              id="profile-job"
              autoComplete="off"
              className={FIELD_INPUT_CLASS}
              {...form.register("job")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="profile-role" className={FIELD_LABEL_CLASS}>
              {t("labels.role")}
            </label>
            <Input
              id="profile-role"
              value={data.role.name}
              readOnly
              disabled
              className={`${FIELD_INPUT_CLASS} cursor-not-allowed opacity-70`}
            />
            <p className="text-[11px] italic text-[color:var(--orion-ink-3)]">
              {canManageRoles
                ? t("helpers.roleManagedInMembers")
                : t("helpers.roleImmutable")}
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={updateUserSelf.isPending}
            className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-settings)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
            style={{
              borderColor: "color-mix(in oklab, var(--brand-settings) 70%, black)",
            }}
          >
            {t("save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
