"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateRole,
  useDeleteRole,
  useUpdateRole,
} from "@/hooks/use-roles";
import { PERMISSION_DOMAINS, type RoleRead } from "@/lib/schemas/role";

export type RoleEditorSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the sheet edits this custom role; otherwise it creates one. */
  initial?: RoleRead;
};

const FOOTER_DELETE_CLASS =
  "h-auto gap-[7px] rounded-[6px] border bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--status-err)] shadow-none hover:bg-[color:color-mix(in_oklab,var(--status-err)_8%,var(--orion-surface))]";

/** Build the initial permission set from a role's permission codes. */
function permsToSet(role: RoleRead | undefined): Set<string> {
  return new Set((role?.permissions ?? []).map((p) => p.code));
}

/**
 * Create / edit a custom (company-owned) role.
 *
 * Fields: name, code (create-only), description, and a per-domain read/write
 * toggle grid covering every seeded permission domain. "Write" implies "read"
 * for UX clarity — toggling write on also turns read on, and turning read off
 * clears write.
 */
export function RoleEditorSheet({ open, onOpenChange, initial }: RoleEditorSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Re-mount the body per editing session so its form state initializes
          straight from `initial` — no reset-on-open effect (the React-compiler
          way to "reset all state when a prop changes"). The body is only
          rendered while `open`, since Radix mounts SheetContent on demand. */}
      {open ? (
        <RoleEditorBody
          key={initial?.id ?? "new"}
          onOpenChange={onOpenChange}
          initial={initial}
        />
      ) : null}
    </Sheet>
  );
}

function RoleEditorBody({
  onOpenChange,
  initial,
}: {
  onOpenChange: (open: boolean) => void;
  initial?: RoleRead;
}) {
  const t = useTranslations("roles.editor");
  const tDomains = useTranslations("roles.matrix.domains");
  const isEdit = !!initial;

  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();
  const isPending = createRole.isPending || updateRole.isPending || deleteRole.isPending;

  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [perms, setPerms] = useState<Set<string>>(() => permsToSet(initial));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const togglePerm = (domain: string, action: "read" | "write", enabled: boolean) => {
    setPerms((prev) => {
      const next = new Set(prev);
      const readCode = `${domain}.read`;
      const writeCode = `${domain}.write`;
      if (action === "write") {
        if (enabled) {
          next.add(writeCode);
          next.add(readCode); // write implies read
        } else {
          next.delete(writeCode);
        }
      } else {
        if (enabled) {
          next.add(readCode);
        } else {
          next.delete(readCode);
          next.delete(writeCode); // no read ⇒ no write
        }
      }
      return next;
    });
  };

  const permissionCodes = useMemo(() => [...perms].sort(), [perms]);

  const handleSubmit = async () => {
    try {
      if (isEdit && initial) {
        await updateRole.mutateAsync({
          id: initial.id,
          payload: {
            name: name.trim(),
            description: description.trim() || null,
            permission_codes: permissionCodes,
          },
        });
        toast.success(t("toasts.updated"));
      } else {
        await createRole.mutateAsync({
          code: code.trim().toLowerCase(),
          name: name.trim(),
          description: description.trim() || null,
          permission_codes: permissionCodes,
        });
        toast.success(t("toasts.created"));
      }
      onOpenChange(false);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      toast.error(t("toasts.error"), detail ? { description: detail } : undefined);
    }
  };

  const handleDelete = async () => {
    if (!isEdit || !initial) return;
    try {
      await deleteRole.mutateAsync(initial.id);
      toast.success(t("toasts.deleted"));
      setConfirmDelete(false);
      onOpenChange(false);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      toast.error(t("toasts.error"), detail ? { description: detail } : undefined);
    }
  };

  const canSubmit = name.trim().length > 0 && (isEdit || code.trim().length > 0);

  return (
    <>
      <SheetContent
        side="right"
        className="w-full gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-[480px]"
        data-testid="role-editor-sheet"
      >
        <SheetHeader className="gap-1 border-b border-[color:var(--orion-line-soft)] px-[22px] py-[18px]">
          <SheetTitle className="font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {isEdit ? t("title.edit") : t("title.new")}
          </SheetTitle>
          <SheetDescription className="text-[12px] text-[color:var(--orion-ink-3)]">
            {t("subtitle")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-[22px] py-[18px]">
          <div className="space-y-1.5">
            <Label htmlFor="role-name">{t("fields.name")}</Label>
            <Input
              id="role-name"
              data-testid="role-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="role-code">{t("fields.code")}</Label>
              <Input
                id="role-code"
                data-testid="role-code-input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t("fields.codePlaceholder")}
                maxLength={50}
              />
              <p className="text-[11px] text-[color:var(--orion-ink-3)]">{t("fields.codeHint")}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="role-description">{t("fields.description")}</Label>
            <Textarea
              id="role-description"
              data-testid="role-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={255}
              rows={2}
            />
          </div>

          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
              {t("fields.permissions")}
            </h3>
            <div className="overflow-hidden rounded-[10px] border border-[color:var(--orion-line-soft)]">
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                <span>{t("columns.domain")}</span>
                <span className="text-center">{t("columns.read")}</span>
                <span className="text-center">{t("columns.write")}</span>
              </div>
              {PERMISSION_DOMAINS.map((domain) => {
                const hasRead = perms.has(`${domain}.read`);
                const hasWrite = perms.has(`${domain}.write`);
                return (
                  <div
                    key={domain}
                    data-testid={`perm-row-${domain}`}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-b border-[color:var(--orion-line-soft)] px-3 py-2 last:border-b-0"
                  >
                    <span className="text-[13px] text-[color:var(--orion-ink)]">
                      {tDomains(domain)}
                    </span>
                    <Switch
                      data-testid={`perm-${domain}-read`}
                      aria-label={`${tDomains(domain)} ${t("columns.read")}`}
                      checked={hasRead}
                      onCheckedChange={(v) => togglePerm(domain, "read", v)}
                    />
                    <Switch
                      data-testid={`perm-${domain}-write`}
                      aria-label={`${tDomains(domain)} ${t("columns.write")}`}
                      checked={hasWrite}
                      onCheckedChange={(v) => togglePerm(domain, "write", v)}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <SheetFooter className="flex-row items-center gap-2 border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] px-[22px] py-[14px] sm:justify-between">
          {isEdit ? (
            <Button
              type="button"
              variant="ghost"
              className={FOOTER_DELETE_CLASS}
              onClick={() => setConfirmDelete(true)}
              disabled={isPending}
              data-testid="role-delete-button"
            >
              <Trash2 size={13} strokeWidth={1.8} />
              {t("actions.delete")}
            </Button>
          ) : (
            <span aria-hidden />
          )}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="h-auto gap-[7px] rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
            >
              {t("actions.cancel")}
            </Button>
            <Button
              type="button"
              disabled={isPending || !canSubmit}
              onClick={() => void handleSubmit()}
              data-testid="role-save-button"
              className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-settings)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
              style={{
                borderColor: "color-mix(in oklab, var(--brand-settings) 70%, black)",
              }}
            >
              {t("actions.save")}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("actions.delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("actions.confirmDelete")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteRole.isPending}>
              {t("actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteRole.isPending}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {t("actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
