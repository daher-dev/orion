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
  StockSettingsRead,
  StockSettingsUpdate,
} from "@/lib/schemas/stock-settings";

/**
 * GET /v1/stock/settings — the company-wide low-stock alert threshold.
 * Tenant-scoped via the X-Orion-Company-Id header.
 */
export function useStockSettings(): UseQueryResult<StockSettingsRead, ApiError> {
  const api = useApi();
  return useQuery<StockSettingsRead, ApiError>({
    queryKey: qk.settings.stockAlerts(),
    queryFn: () => api.get<StockSettingsRead>("/v1/stock/settings"),
  });
}

/** PUT /v1/stock/settings — replace the company-wide threshold. */
export function useUpdateStockSettings() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<StockSettingsRead, ApiError, StockSettingsUpdate>({
    mutationFn: (payload) =>
      api.put<StockSettingsRead>("/v1/stock/settings", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.settings.stockAlerts() });
      // The dashboard low-stock KPI + stock list reflect this threshold.
      qc.invalidateQueries({ queryKey: qk.stock.all() });
    },
  });
}
