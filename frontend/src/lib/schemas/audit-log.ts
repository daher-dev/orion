import { z } from "zod";

/**
 * Zod schemas for FEATURE-018 (Settings → Audit Log Viewer).
 *
 * Mirrors the backend `schemas/audit_log.py` shapes 1:1. We keep the
 * `user` actor projection separate (instead of reusing the bigger
 * `MeUser`) because the list payload only ships `{id, name}` — keeping
 * the type narrow avoids tempting callers into reading fields that
 * aren't in the response.
 */

export const auditLogActorSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const auditLogReadSchema = z.object({
  id: z.string(),
  user: auditLogActorSchema.nullable().optional(),
  resource_type: z.string(),
  resource_id: z.string(),
  message: z.string(),
  created_at: z.string(),
});

export const auditLogPageSchema = z.object({
  items: z.array(auditLogReadSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  has_more: z.boolean(),
});

export type AuditLogActor = z.infer<typeof auditLogActorSchema>;
export type AuditLogRead = z.infer<typeof auditLogReadSchema>;
export type AuditLogPage = z.infer<typeof auditLogPageSchema>;

/**
 * Filters accepted by the audit-log list hook. `pageSize` is camelCase
 * on the client; the hook converts it to `page_size` when building the
 * query string — matching the backend's snake_case API.
 */
export type AuditLogFilters = {
  q?: string;
  resource_type?: string;
  user_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  pageSize?: number;
};

/**
 * Known `resource_type` values used by every domain service when
 * writing audit entries — kept in sync with the strings passed to
 * `services._audit.write_audit` across the backend.
 */
export const AUDIT_RESOURCE_TYPES = [
  "orders",
  "clients",
  "ads",
  "products",
  "product_variations",
  "product_specs",
  "spec_trims",
  "print_designs",
  "fabric_rolls",
  "cutting_orders",
  "cutting_order_outputs",
  "sewing_contractors",
  "sewing_shipments",
  "sewing_shipment_items",
  "stock_entries",
  "stock_exits",
  "companies",
  "users",
  "roles",
  "permissions",
  "invites",
] as const;

export type AuditResourceType = (typeof AUDIT_RESOURCE_TYPES)[number];
