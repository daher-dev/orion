"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { qk } from "@/lib/query-keys";
import type { ApiError } from "@/lib/api-client";
import type {
  CompanySettings,
  CompanySettingsUpdate,
} from "@/lib/schemas/company-settings";

const PATH = "/v1/company/settings";

/**
 * GET /v1/company/settings — the per-tenant catalog config + low-stock
 * thresholds. The backend seeds a default `config` on first read, so this
 * never 404s. Tenant-scoped via the X-Orion-Company-Id header.
 */
export function useCatalogConfig(): UseQueryResult<CompanySettings, ApiError> {
  const api = useApi();
  return useQuery<CompanySettings, ApiError>({
    queryKey: qk.settings.catalog(),
    queryFn: () => api.get<CompanySettings>(PATH),
  });
}

/**
 * PUT /v1/company/settings — full replace of the `config` blob. Catalog
 * palettes feed the prints/products pickers and the thresholds drive the
 * low-stock alerts, so invalidate those caches on success too.
 */
export function useUpdateCatalogConfig() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<CompanySettings, ApiError, CompanySettingsUpdate>({
    mutationFn: (payload) => api.put<CompanySettings>(PATH, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.settings.catalog() });
      // Thresholds live in the same blob as the legacy stock-alerts surface.
      qc.invalidateQueries({ queryKey: qk.settings.stockAlerts() });
      // Print colors / techniques feed the estampas pickers.
      qc.invalidateQueries({ queryKey: qk.prints.all() });
    },
  });
}
