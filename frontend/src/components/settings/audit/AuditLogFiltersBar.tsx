"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
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
  AUDIT_RESOURCE_TYPES,
  type AuditLogActor,
} from "@/lib/schemas/audit-log";

/**
 * Audit-log filters toolbar — sits at the top of the table card.
 *
 * Layout port from `.toolbar` in `/docs/design/source/styles.css`:
 *
 *   - flex, gap 8px, padding 12 16, bg surface, border-b line-soft.
 *   - Wraps on narrow viewports; each control is its own 6px-radius input.
 *
 * Controlled component — the parent owns the filter state so URL
 * synchronisation can live in one place if we add it later.
 */

export type AuditLogFiltersBarProps = {
  q: string;
  onQChange: (value: string) => void;
  resourceType: string;
  onResourceTypeChange: (value: string) => void;
  userId: string;
  onUserIdChange: (value: string) => void;
  userOptions: AuditLogActor[];
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  onClear: () => void;
  canClear: boolean;
};

/** Sentinel value used in shadcn/radix `Select` — empty strings aren't allowed. */
const ALL_VALUE = "__all__";

export function AuditLogFiltersBar(props: AuditLogFiltersBarProps) {
  const t = useTranslations("audit");

  return (
    <div
      // .toolbar — surface bg, line-soft border-b, 12 16 padding, 8 gap,
      // wraps. Items are flat-row equal-height inputs.
      className="flex flex-wrap items-center gap-2 border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-4 py-3"
      data-testid="audit-filters"
    >
      {/* .tb-input — bg=bg, line border, 6 radius, padding 5 10, 12.5px,
          gap 6, min-w 180px. */}
      <div className="flex min-w-[220px] flex-1 items-center gap-1.5 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)]">
        <Search className="size-3.5 text-[color:var(--orion-ink-3)]" />
        <Input
          aria-label={t("filters.searchPlaceholder")}
          placeholder={t("filters.searchPlaceholder")}
          value={props.q}
          onChange={(e) => props.onQChange(e.target.value)}
          className="h-auto border-0 bg-transparent p-0 text-[12.5px] text-[color:var(--orion-ink)] shadow-none placeholder:text-[color:var(--orion-ink-3)] focus-visible:ring-0"
        />
      </div>

      <ResourceTypeSelect
        value={props.resourceType}
        onChange={props.onResourceTypeChange}
        placeholder={t("filters.resourceType")}
        allLabel={t("filters.allResources")}
      />

      <UserSelect
        value={props.userId}
        onChange={props.onUserIdChange}
        options={props.userOptions}
        placeholder={t("filters.user")}
        allLabel={t("filters.allUsers")}
      />

      {/* Native date inputs — shadcn's calendar primitive is overkill for
          a one-shot picker on a filters bar. We style the native input to
          match the surrounding .tb-input. */}
      <DateInput
        value={props.dateFrom}
        onChange={props.onDateFromChange}
        ariaLabel={t("filters.dateFrom")}
      />
      <DateInput
        value={props.dateTo}
        onChange={props.onDateToChange}
        ariaLabel={t("filters.dateTo")}
      />

      {props.canClear ? (
        <Button
          type="button"
          variant="ghost"
          onClick={props.onClear}
          // .btn-ghost — transparent, ink-2 text, surface-2 hover.
          className="h-auto gap-1 rounded-[6px] border border-transparent bg-transparent !px-[10px] py-[6px] text-[12.5px] font-medium text-[color:var(--orion-ink-2)] hover:bg-[color:var(--orion-surface-2)] hover:text-[color:var(--orion-ink)]"
        >
          <X className="size-3.5" />
          {t("filters.clear")}
        </Button>
      ) : null}
    </div>
  );
}

function ResourceTypeSelect({
  value,
  onChange,
  placeholder,
  allLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  allLabel: string;
}) {
  const t = useTranslations("audit.resourceTypes");
  // Sentinel mapping — Radix forbids empty-string SelectItem values.
  return (
    <Select
      value={value === "" ? ALL_VALUE : value}
      onValueChange={(v) => onChange(v === ALL_VALUE ? "" : v)}
    >
      <SelectTrigger
        aria-label={placeholder}
        // Match the .tb-input look — bg=bg, line border, 6 radius.
        className="h-auto min-w-[160px] gap-1.5 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)] shadow-none data-[placeholder]:text-[color:var(--orion-ink-3)]"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>{allLabel}</SelectItem>
        {AUDIT_RESOURCE_TYPES.map((rt) => (
          <SelectItem key={rt} value={rt}>
            {t(rt)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function UserSelect({
  value,
  onChange,
  options,
  placeholder,
  allLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: AuditLogActor[];
  placeholder: string;
  allLabel: string;
}) {
  return (
    <Select
      value={value === "" ? ALL_VALUE : value}
      onValueChange={(v) => onChange(v === ALL_VALUE ? "" : v)}
    >
      <SelectTrigger
        aria-label={placeholder}
        className="h-auto min-w-[160px] gap-1.5 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)] shadow-none data-[placeholder]:text-[color:var(--orion-ink-3)]"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>{allLabel}</SelectItem>
        {options.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            {u.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DateInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <Input
      type="date"
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-auto min-w-[140px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink)] shadow-none focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--brand-settings)_16%,transparent)]"
    />
  );
}
