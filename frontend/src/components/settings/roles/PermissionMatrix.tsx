"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { PermCell, type PermCellKind } from "@/components/settings/roles/PermCell";
import type { RoleList, RoleRead } from "@/lib/schemas/role";

/**
 * Read-only permissions matrix — second row of content inside the Roles pane.
 *
 * Mirrors the Card + table at lines 369-396 of
 * /docs/design/source/pages/settings.jsx:
 *
 *   - Columns: Capacidade (50% width) · Admin · Gestor · Operador
 *     (~16.66% each, right-aligned `.num`).
 *   - Five group headers (Sales/Catalog/Production/Stock/System) rendered
 *     as full-width `.tbl` rows with a 10.5px uppercase .14em-tracked ink-3
 *     label on a `--orion-bg` background.
 *   - Each capability row maps the friendly label → one of the three
 *     `PermCell` states (`all` / `view` / `none`) by inspecting the role's
 *     seeded permission codes from
 *     /backend/alembic/versions/3187f02cbc35_seed_roles_and_permissions.py.
 *
 * Capabilities that don't have a clean 1:1 backend code (Sistema → reports /
 * billing / integrations) fall back to a hard-coded per-role state pulled
 * straight from the design's `SETTINGS_DATA.permissions` so the matrix still
 * communicates the *intent* of the spec; once the backend grows those domains
 * the `derive` callback can be updated to query them directly.
 */

export type PermissionMatrixProps = {
  roles: RoleList;
};

/** All possible cell kinds a capability can resolve to for a given role. */
type Derive = (role: RoleRead) => PermCellKind;

/** Combine read+write on a single backend domain into a tri-state cell. */
function deriveFromDomain(domain: string): Derive {
  return (role) => {
    // We pass strings here so the `domain` argument can be any code, including
    // hypothetical future domains the backend grows.
    const w = role.permissions.some((p) => p.code === `${domain}.write`);
    if (w) return "all";
    const r = role.permissions.some((p) => p.code === `${domain}.read`);
    if (r) return "view";
    return "none";
  };
}

/** Hardcode a per-role-code state — used for capabilities without a backend code. */
function deriveStatic(map: Record<string, PermCellKind>, fallback: PermCellKind): Derive {
  return (role) => map[role.code] ?? fallback;
}

/** Hand-picked single permission code lookups (e.g. write-only capabilities). */
function deriveFromCode(code: string, present: PermCellKind = "all"): Derive {
  return (role) => (role.permissions.some((p) => p.code === code) ? present : "none");
}

type CapabilityGroup = {
  /** i18n key under `roles.matrix.groups.*` */
  groupKey: string;
  items: ReadonlyArray<{
    /** i18n key under `roles.matrix.capabilities.*` */
    labelKey: string;
    derive: Derive;
  }>;
};

/**
 * Hard-coded capability matrix that mirrors the design source's
 * `SETTINGS_DATA.permissions` row-for-row.  Whenever the backend supports a
 * matching `<domain>.<action>` code we derive from it; otherwise we fall back
 * to the static states from the design (System group: reports / billing /
 * integrations / team).
 *
 * Keep the row order identical to the design source — it sets reader
 * expectations.
 */
const MATRIX: ReadonlyArray<CapabilityGroup> = [
  {
    groupKey: "sales",
    items: [
      { labelKey: "ordersView", derive: deriveFromCode("orders.read", "all") },
      { labelKey: "ordersWrite", derive: deriveFromCode("orders.write", "all") },
      // Cancel orders shares the write permission with create/edit.
      { labelKey: "ordersCancel", derive: deriveFromCode("orders.write", "all") },
      { labelKey: "clientsView", derive: deriveFromCode("clients.read", "all") },
    ],
  },
  {
    groupKey: "catalog",
    items: [
      { labelKey: "specsWrite", derive: deriveFromDomain("specs") },
      { labelKey: "productsPrice", derive: deriveFromCode("products.write", "all") },
      { labelKey: "productsPublish", derive: deriveFromCode("products.write", "all") },
    ],
  },
  {
    groupKey: "production",
    items: [
      { labelKey: "cuttingOpen", derive: deriveFromDomain("cutting") },
      { labelKey: "stockOutputs", derive: deriveFromDomain("stock") },
      { labelKey: "contractorsManage", derive: deriveFromDomain("contractors") },
    ],
  },
  {
    groupKey: "stock",
    items: [
      { labelKey: "fabricReceive", derive: deriveFromDomain("fabric") },
      { labelKey: "stockAdjust", derive: deriveFromDomain("stock") },
    ],
  },
  {
    groupKey: "system",
    items: [
      // Reports + billing + integrations have no backend perm yet — fall back
      // to the design's static admin=all, manager=*, operator=none matrix.
      {
        labelKey: "reportsView",
        derive: deriveStatic(
          { admin: "all", manager: "all", operator: "none" },
          "none",
        ),
      },
      // Manage team derives directly: admin has users.write, manager has
      // users.read only (view), operator has neither (none).
      { labelKey: "teamManage", derive: deriveFromDomain("users") },
      // Billing — admin only.
      {
        labelKey: "billing",
        derive: deriveStatic(
          { admin: "all", manager: "none", operator: "none" },
          "none",
        ),
      },
      // Integrations — admin all, manager view, operator none.
      {
        labelKey: "integrations",
        derive: deriveStatic(
          { admin: "all", manager: "view", operator: "none" },
          "none",
        ),
      },
    ],
  },
];

export function PermissionMatrix({ roles }: PermissionMatrixProps) {
  const t = useTranslations("roles.matrix");
  const tCell = useTranslations("roles.matrix.cell");

  // Pre-build the row data so render stays declarative; also keeps each
  // derive call running once per role-row pair.
  const rows = useMemo(
    () =>
      MATRIX.map((group) => ({
        groupKey: group.groupKey,
        items: group.items.map((item) => ({
          labelKey: item.labelKey,
          cells: roles.map((role) => ({ role, kind: item.derive(role) })),
        })),
      })),
    [roles],
  );

  // Total column count = label column + one column per role. Used by the
  // group header rows' `colSpan`.
  const totalCols = 1 + roles.length;

  return (
    <table
      className="w-full border-separate border-spacing-0 text-[13px]"
      data-testid="permission-matrix"
    >
      <thead>
        <tr>
          {/* Capacidade — 50% width, left-aligned. */}
          <th
            scope="col"
            style={{ width: "50%" }}
            className="border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[14px] py-[10px] text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]"
          >
            {t("columns.capability")}
          </th>
          {roles.map((role) => (
            <th
              key={role.id}
              scope="col"
              data-role-code={role.code}
              // `.num` from design = right-aligned tabular-nums.  Each role
              // column is ~16.66% wide (3 roles in the remaining 50%).
              style={{ width: `${50 / Math.max(roles.length, 1)}%` }}
              className="border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[14px] py-[10px] text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)] [font-variant-numeric:tabular-nums]"
            >
              {role.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((group, gi) => (
          <SubTableSection
            key={group.groupKey}
            label={t(`groups.${group.groupKey}` as `groups.${string}`)}
            cols={totalCols}
            items={group.items}
            isLastGroup={gi === rows.length - 1}
            tCell={tCell}
          />
        ))}
      </tbody>
    </table>
  );
}

/** Renders a group header followed by its capability rows.  Kept inline so the
 *  parent can manage `isLastGroup` and the per-row hover state without
 *  prop-drilling through another component layer. */
function SubTableSection({
  label,
  cols,
  items,
  isLastGroup,
  tCell,
}: {
  label: string;
  cols: number;
  items: Array<{
    labelKey: string;
    cells: Array<{ role: RoleRead; kind: PermCellKind }>;
  }>;
  isLastGroup: boolean;
  tCell: ReturnType<typeof useTranslations>;
}) {
  return (
    <>
      {/* Group header — full-width row with `--orion-bg` background and the
          10.5px uppercase .14em-tracked ink-3 label from design line 133-140. */}
      <tr data-testid="matrix-group" data-group={label}>
        <td
          colSpan={cols}
          className="bg-[color:var(--orion-bg)] px-[14px] py-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[color:var(--orion-ink-3)]"
        >
          {label}
        </td>
      </tr>
      {items.map((item, ri) => {
        const isLast = isLastGroup && ri === items.length - 1;
        return (
          <tr
            key={item.labelKey}
            data-testid="matrix-row"
            data-capability={item.labelKey}
            className="hover:[&_td]:bg-[color:var(--orion-bg)]"
          >
            {/* Capability label — ink colour, 500 weight. */}
            <td
              className={`px-[14px] py-[12px] align-middle font-medium text-[color:var(--orion-ink)] ${
                isLast ? "" : "border-b border-[color:var(--orion-line-soft)]"
              }`}
            >
              <CapabilityLabel labelKey={item.labelKey} />
            </td>
            {item.cells.map(({ role, kind }) => (
              <td
                key={role.id}
                data-role-code={role.code}
                data-cell-kind={kind}
                className={`px-[14px] py-[12px] align-middle text-right [font-variant-numeric:tabular-nums] ${
                  isLast ? "" : "border-b border-[color:var(--orion-line-soft)]"
                }`}
              >
                <PermCell kind={kind} label={tCell(kind)} />
              </td>
            ))}
          </tr>
        );
      })}
    </>
  );
}

/** Tiny presentational wrapper so the typed i18n key narrows correctly. */
function CapabilityLabel({ labelKey }: { labelKey: string }) {
  const tCap = useTranslations("roles.matrix.capabilities");
  return <>{tCap(labelKey as Parameters<typeof tCap>[0])}</>;
}
