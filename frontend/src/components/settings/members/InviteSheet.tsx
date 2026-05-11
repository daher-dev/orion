"use client";

import { useId, useState } from "react";
import { Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCreateInvite } from "@/hooks/use-invites";
import { useRoles } from "@/hooks/use-roles";
import { inviteCreateSchema } from "@/lib/schemas/invite";

const FIELD_LABEL_CLASS =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_INPUT_CLASS =
  "h-auto rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-[8px] text-[13px] text-[color:var(--orion-ink)] shadow-none focus-visible:border-[color:var(--brand-settings)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--brand-settings)_16%,transparent)]";

export type InviteSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Side-sheet for sending a new invite. Direct port of design's `.sheet`:
 *   480px wide, right-anchored, surface bg, line-left border, deep shadow.
 *
 * Form has just two fields: email (text) + role (select). On submit, fires
 * `POST /v1/invites`; on success, closes the sheet and surfaces a toast.
 * A 409 from the backend is translated into the "already pending" toast.
 *
 * To avoid setState-in-effect lint warnings we mount this component conditionally
 * from the parent (`{open ? <InviteSheetInner … /> : null}`), so the inner form
 * picks up fresh defaults on every open via render-time initialization.
 */
export function InviteSheet({ open, onOpenChange }: InviteSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? <InviteSheetInner onOpenChange={onOpenChange} /> : null}
    </Sheet>
  );
}

function InviteSheetInner({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("invite.form");
  const formId = useId();
  const { data: roles, isPending: rolesPending } = useRoles();
  const createInvite = useCreateInvite();

  // Initialize from the data we have *at first render*. No effects needed —
  // the parent re-mounts this component when the sheet re-opens.
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<string>(() => roles?.[0]?.id ?? "");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  // Once roles arrive (if they were pending at mount), adopt the first one
  // automatically — without an effect — by syncing the selected id during render.
  if (!roleId && roles && roles.length > 0) {
    setRoleId(roles[0].id);
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    let valid = true;
    if (!email.trim()) {
      setEmailError(t("validation.emailRequired"));
      valid = false;
    } else {
      setEmailError(null);
    }
    if (!roleId) {
      setRoleError(t("validation.roleRequired"));
      valid = false;
    } else {
      setRoleError(null);
    }
    if (!valid) return;

    const parsed = inviteCreateSchema.safeParse({ email: email.trim(), role_id: roleId });
    if (!parsed.success) {
      setEmailError(t("validation.emailInvalid"));
      return;
    }

    try {
      await createInvite.mutateAsync(parsed.data);
      toast.success(t("toasts.created"));
      onOpenChange(false);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      const isDup = detail.toLowerCase().includes("already exists");
      toast.error(
        isDup ? t("toasts.duplicate") : t("toasts.error"),
        !isDup && detail ? { description: detail } : undefined,
      );
    }
  };

  return (
    <SheetContent
      side="right"
      className="w-full gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-[480px]"
    >
      <SheetHeader className="gap-1 border-b border-[color:var(--orion-line-soft)] px-[22px] py-[18px]">
        <SheetTitle className="flex items-center gap-2 font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
          <Mail className="size-4 text-[color:var(--brand-settings)]" />
          {t("title")}
        </SheetTitle>
        <SheetDescription className="text-[12.5px] text-[color:var(--orion-ink-3)]">
          {t("sub")}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-[22px] py-[18px]">
        <form
          id={formId}
          data-testid="invite-form"
          onSubmit={(e) => void handleSubmit(e)}
          className="grid gap-[18px]"
          noValidate
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="invite-email" className={FIELD_LABEL_CLASS}>
              {t("labels.email")}
            </label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="off"
              placeholder={t("placeholders.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!emailError}
              className={FIELD_INPUT_CLASS}
            />
            {emailError ? (
              <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
                {emailError}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="invite-role" className={FIELD_LABEL_CLASS}>
              {t("labels.role")}
            </label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger
                id="invite-role"
                aria-invalid={!!roleError}
                className={`${FIELD_INPUT_CLASS} w-full`}
                data-testid="invite-role-trigger"
                disabled={rolesPending}
              >
                <SelectValue placeholder={t("placeholders.role")} />
              </SelectTrigger>
              <SelectContent>
                {(roles ?? []).map((role) => (
                  <SelectItem key={role.id} value={role.id} className="text-[13px]">
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {roleError ? (
              <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
                {roleError}
              </p>
            ) : null}
          </div>
        </form>
      </div>

      <SheetFooter className="flex-row justify-end gap-2 border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] px-[22px] py-[14px]">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={createInvite.isPending}
          className="h-auto gap-[7px] rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
        >
          {t("cancel")}
        </Button>
        <Button
          type="submit"
          form={formId}
          disabled={createInvite.isPending}
          data-testid="invite-submit"
          className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-settings)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
          style={{ borderColor: "color-mix(in oklab, var(--brand-settings) 70%, black)" }}
        >
          {t("save")}
        </Button>
      </SheetFooter>
    </SheetContent>
  );
}
