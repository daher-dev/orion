"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { qk } from "@/lib/query-keys";
import type { ApiError } from "@/lib/api-client";
import type { DashboardSummary } from "@/lib/schemas/dashboard";

export function useDashboardSummary(): UseQueryResult<DashboardSummary, ApiError> {
  const api = useApi();
  return useQuery<DashboardSummary, ApiError>({
    queryKey: qk.dashboard.summary(),
    queryFn: () => api.get<DashboardSummary>("/v1/dashboard/summary"),
    staleTime: 60 * 1000,
  });
}
