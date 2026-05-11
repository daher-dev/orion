"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  PERMISSION_DOMAINS,
  rolePermits,
  type PermissionDomain,
  type RoleList,
} from "@/lib/schemas/role";

/**
 * Read-only permission matrix.
 *
 * Columns: the company's available roles (admin / manager / operator).
 * Rows: every permission domain known to the backend (kept in lockstep with
 *       `PERMISSION_DOMAINS`).
 * Cell: two stacked check icons — teal for `read`, stone for `write` — when the
 *       role grants that domain.action. Empty cell shows a muted dash so the
 *       grid stays scannable.
 */
export type PermissionMatrixProps = {
  roles: RoleList;
};

export function PermissionMatrix({ roles }: PermissionMatrixProps) {
  const t = useTranslations("roles.matrix");

  return (
    <table className="w-full border-separate border-spacing-0 text-[13px]" data-testid="permission-matrix">
      <thead>
        <tr>
          <th className="border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[14px] py-[10px] text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
            {t("domain")}
          </th>
          {roles.map((role) => (
            <th
              key={role.id}
              data-role-code={role.code}
              className="border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[14px] py-[10px] text-center text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]"
            >
              {role.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {PERMISSION_DOMAINS.map((domain, idx) => (
          <tr key={domain} data-testid="matrix-row" data-domain={domain}>
            <td
              className={`px-[14px] py-[12px] align-middle font-medium text-[color:var(--orion-ink)] ${idx < PERMISSION_DOMAINS.length - 1 ? "border-b border-[color:var(--orion-line-soft)]" : ""}`}
            >
              {t(`domains.${domain}` as `domains.${PermissionDomain}`)}
            </td>
            {roles.map((role) => {
              const canRead = rolePermits(role, domain, "read");
              const canWrite = rolePermits(role, domain, "write");
              return (
                <td
                  key={`${role.id}-${domain}`}
                  data-role-code={role.code}
                  data-domain={domain}
                  data-can-read={canRead ? "true" : undefined}
                  data-can-write={canWrite ? "true" : undefined}
                  className={`px-[14px] py-[12px] align-middle text-center ${idx < PERMISSION_DOMAINS.length - 1 ? "border-b border-[color:var(--orion-line-soft)]" : ""}`}
                >
                  {canRead || canWrite ? (
                    <div className="flex items-center justify-center gap-1.5">
                      {canRead ? (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-[color:var(--brand-prod)]"
                          title={t("actions.read")}
                          data-testid="cell-read"
                        >
                          <Check className="size-3.5" strokeWidth={2.5} />
                          {t("actions.read")}
                        </span>
                      ) : null}
                      {canWrite ? (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-[color:var(--brand-settings)]"
                          title={t("actions.write")}
                          data-testid="cell-write"
                        >
                          <Check className="size-3.5" strokeWidth={2.5} />
                          {t("actions.write")}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <span
                      className="text-[12px] text-[color:var(--orion-ink-3)]"
                      data-testid="cell-empty"
                    >
                      {t("none")}
                    </span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
