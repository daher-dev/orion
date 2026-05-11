"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/providers/auth-provider";
import { qk } from "@/lib/query-keys";
import type { ApiError } from "@/lib/api-client";
import type { DashboardSummary } from "@/lib/schemas/dashboard";

export function useDashboardSummary(): UseQueryResult<DashboardSummary, ApiError> {
  const api = useApi();
  const { user, loading } = useAuth();
  return useQuery<DashboardSummary, ApiError>({
    // Key on user.uid so a fresh sign-in (or hydration from a window
    // where user wasn't yet populated) gets a clean cache entry instead
    // of inheriting a stale "no auth → 401" error state.
    queryKey: [...qk.dashboard.summary(), user?.uid ?? "anon"],
    queryFn: () => api.get<DashboardSummary>("/v1/dashboard/summary"),
    enabled: !loading && !!user,
    staleTime: 60 * 1000,
  });
}
