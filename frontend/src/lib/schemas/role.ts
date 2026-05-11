import { z } from "zod";

export const permissionReadSchema = z.object({
  code: z.string(),
  description: z.string().nullable().optional(),
});

export const roleReadSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  permissions: z.array(permissionReadSchema).default([]),
});

export const roleListSchema = z.array(roleReadSchema);

export type PermissionRead = z.infer<typeof permissionReadSchema>;
export type RoleRead = z.infer<typeof roleReadSchema>;
export type RoleList = z.infer<typeof roleListSchema>;

/**
 * Permission domain → human-translated label. The `roles.matrix.domains.*` i18n keys
 * exist in EN + PT-BR for the same list. Keep this list in sync with the seeded
 * permissions in `backend/alembic/versions/3187f02cbc35_seed_roles_and_permissions.py`.
 */
export const PERMISSION_DOMAINS = [
  "ads",
  "clients",
  "companies",
  "contractors",
  "cutting",
  "fabric",
  "orders",
  "prints",
  "products",
  "roles",
  "sewing",
  "specs",
  "stock",
  "users",
] as const;

export type PermissionDomain = (typeof PERMISSION_DOMAINS)[number];

export type PermissionAction = "read" | "write";

/**
 * Resolve whether a role grants `<domain>.<action>` by looking at its permission codes.
 */
export function rolePermits(
  role: RoleRead,
  domain: PermissionDomain,
  action: PermissionAction,
): boolean {
  const wanted = `${domain}.${action}`;
  return role.permissions.some((p) => p.code === wanted);
}
