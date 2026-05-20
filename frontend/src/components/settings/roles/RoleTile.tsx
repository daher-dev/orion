"use client";

import type { CSSProperties } from "react";
import { Shield } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Single role tile rendered in the 3-up grid at the top of the Roles pane.
 *
 * Direct port of the `SETTINGS_DATA.roles.map(...)` card in
 * /docs/design/source/pages/settings.jsx (~lines 346-366):
 *
 *   - 1px line border, 14px radius (the design `.card`).
 *   - 3px coloured top stripe (admin=#7c5cff, manager=#0ea5e9,
 *     operator=#10b981) — `tone` prop drives the strip + icon tint.
 *   - 30×30 rounded-8 tile holding the Shield icon, tinted with the tone.
 *   - 18px Fraunces role name, right-aligned `.pill muted` member count.
 *   - 12.5px ink-3 description on its own line, 1.55 line-height,
 *     `text-wrap: pretty`.
 *
 * The card name + description come from `roles.tiles.byCode.<code>.{name,desc}`
 * i18n keys so we present friendly labels — the backend's `role.name` is the
 * raw English label seeded in the migration ("Administrator", "Manager",
 * "Operator") and is therefore not used in the UI.
 */
export type RoleTileProps = {
  /** Backend role code — `admin` / `manager` / `operator` (or a custom code). */
  code: string;
  /** Number of members assigned this role. */
  memberCount: number;
  /** Hex / CSS color for the 3px top stripe + icon tint. */
  tone: string;
};

export function RoleTile({ code, memberCount, tone }: RoleTileProps) {
  const t = useTranslations("roles.tiles");
  const tByCode = useTranslations("roles.tiles.byCode");

  const knownCode = code === "admin" || code === "manager" || code === "operator";
  // Custom roles (future feature) gracefully fall back to the raw code.
  const name = knownCode ? tByCode(`${code}.name` as `${typeof code}.name`) : code;
  const desc = knownCode
    ? tByCode(`${code}.desc` as `${typeof code}.desc`)
    : "";

  return (
    <div
      data-testid="role-tile"
      data-role-code={code}
      // .card — surface bg, 1px line border, 14px radius.
      // padding 16px and `overflow: hidden` so the absolutely-positioned
      // top stripe clips inside the card.
      className="relative overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-4"
    >
      {/* 3px tone stripe pinned to the top edge — design lines 351. */}
      <span
        aria-hidden="true"
        className="absolute left-0 right-0 top-0 h-[3px]"
        style={{ background: tone }}
      />

      {/* Header row — 30×30 tinted Shield tile + Fraunces name + members pill. */}
      <div className="mt-1 flex items-center gap-2.5">
        <span
          // 30×30, rounded-8, tinted bg (color-mix tone @14%), tone-colored icon.
          className="grid h-[30px] w-[30px] place-items-center rounded-[8px]"
          style={
            {
              background: `color-mix(in oklab, ${tone} 14%, var(--orion-surface))`,
              color: tone,
            } as CSSProperties
          }
        >
          <Shield size={15} strokeWidth={2} />
        </span>
        <div className="font-serif text-[18px] leading-tight text-[color:var(--orion-ink)]">
          {name}
        </div>
        {/* .pill .muted — right-aligned via margin-left auto. */}
        <span
          data-testid="role-member-count"
          // .pill base + .muted variant — 2 8 padding, radius 999, 11.5px /500,
          // surface-2 bg, ink-3 text, line-soft border.
          className="ml-auto inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] px-2 py-[2px] text-[11.5px] font-medium leading-[1.5] text-[color:var(--orion-ink-3)]"
        >
          {t("memberCount", { count: memberCount })}
        </span>
      </div>

      {/* Description — 12.5px ink-3, lh 1.55, text-wrap pretty (design line 363). */}
      {desc ? (
        <div
          className="mt-2.5 text-[12.5px] leading-[1.55] text-[color:var(--orion-ink-3)]"
          style={{ textWrap: "pretty" } as CSSProperties}
        >
          {desc}
        </div>
      ) : null}
    </div>
  );
}
