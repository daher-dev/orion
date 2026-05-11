"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { qk } from "@/lib/query-keys";
import type { ApiError } from "@/lib/api-client";
import type {
  AuditLogFilters,
  AuditLogPage,
} from "@/lib/schemas/audit-log";

/**
 * Build the query-string params for ``GET /v1/audit-logs``.
 *
 * Only sends keys whose value is set so the URL stays clean for the
 * happy path (no `?q=&resource_type=…&user_id=…` noise). The backend
 * accepts the snake_case names; the hook converts the camelCase
 * `pageSize` accordingly.
 */
const buildQuery = (filters: AuditLogFilters | undefined) => {
  if (!filters) return undefined;
  const query: Record<string, string> = {};
  if (filters.q) query.q = filters.q;
  if (filters.resource_type) query.resource_type = filters.resource_type;
  if (filters.user_id) query.user_id = filters.user_id;
  if (filters.date_from) query.date_from = filters.date_from;
  if (filters.date_to) query.date_to = filters.date_to;
  if (filters.page) query.page = String(filters.page);
  if (filters.pageSize) query.page_size = String(filters.pageSize);
  return Object.keys(query).length > 0 ? query : undefined;
};

/**
 * Hook into ``GET /v1/audit-logs`` — the only audit-log endpoint
 * (entries are append-only and the read view is the entire UX surface).
 */
export function useAuditLogs(
  filters?: AuditLogFilters,
): UseQueryResult<AuditLogPage, ApiError> {
  const api = useApi();
  return useQuery<AuditLogPage, ApiError>({
    queryKey: qk.audit.list(filters ?? {}),
    queryFn: () => api.get<AuditLogPage>("/v1/audit-logs", { query: buildQuery(filters) }),
  });
}
