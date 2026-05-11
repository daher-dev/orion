"use client";

import { useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRoles } from "@/hooks/use-roles";
import type { RoleList } from "@/lib/schemas/role";

/**
 * Inline role select for the members table.
 *
 * Mirrors the design's underline-style selects but compressed to the table-row
 * footprint — 13px text, 6px radius, stone focus ring.
 *
 * The value is the role's `id`. Roles are fetched from `/v1/roles` and cached
 * by TanStack so multiple rows reuse the same payload.
 */
export type RoleSelectProps = {
  /** Currently-selected role id. */
  value: string;
  /** Fired when the user picks a different role. */
  onChange: (roleId: string) => void;
  /** Disable the trigger entirely (e.g. for users without `users.write`). */
  disabled?: boolean;
  /** `aria-label` for the trigger when there is no visible label. */
  ariaLabel?: string;
  /** Optional pre-fetched list, useful for tests & places that already loaded roles. */
  roles?: RoleList;
};

export function RoleSelect({ value, onChange, disabled, ariaLabel, roles }: RoleSelectProps) {
  const t = useTranslations("members");
  const remote = useRoles();
  const list = roles ?? remote.data ?? [];

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        aria-label={ariaLabel ?? t("actions.changeRole")}
        data-testid="role-select-trigger"
        className="h-auto w-[140px] gap-[7px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-[6px] text-[12.5px] text-[color:var(--orion-ink)] shadow-none focus-visible:border-[color:var(--brand-settings)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--brand-settings)_16%,transparent)]"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {list.map((role) => (
          <SelectItem key={role.id} value={role.id} className="text-[13px]">
            {role.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
