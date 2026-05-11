"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/providers/auth-provider";
import { qk } from "@/lib/query-keys";
import type { ApiError } from "@/lib/api-client";
import type {
  CostsReport,
  InventoryReport,
  ProductionReport,
  ReportDateRange,
  SalesReport,
} from "@/lib/schemas/reports";

/**
 * Map a ReportDateRange to a sparse query record. Empty bounds are dropped
 * so the URL stays clean and the TanStack key stays stable.
 */
function rangeQuery(range: ReportDateRange | undefined) {
  const params: Record<string, string> = {};
  if (range?.date_from) params.date_from = range.date_from;
  if (range?.date_to) params.date_to = range.date_to;
  return params;
}

/**
 * Stable query-key partial for a (uid, range) pair. The uid is appended so
 * a fresh sign-in (or a hydration where `user` wasn't yet populated) starts
 * with a clean cache entry instead of inheriting a stale 401 error state.
 */
function rangeKey(uid: string | undefined, range: ReportDateRange | undefined) {
  return {
    uid: uid ?? "anon",
    date_from: range?.date_from ?? null,
    date_to: range?.date_to ?? null,
  };
}

const STALE_TIME = 60 * 1000;

export function useSalesReport(
  range?: ReportDateRange,
): UseQueryResult<SalesReport, ApiError> {
  const api = useApi();
  const { user, loading } = useAuth();
  return useQuery<SalesReport, ApiError>({
    queryKey: qk.reports.one("sales", rangeKey(user?.uid, range)),
    queryFn: () => api.get<SalesReport>("/v1/reports/sales", { query: rangeQuery(range) }),
    enabled: !loading && !!user,
    staleTime: STALE_TIME,
  });
}

export function useProductionReport(
  range?: ReportDateRange,
): UseQueryResult<ProductionReport, ApiError> {
  const api = useApi();
  const { user, loading } = useAuth();
  return useQuery<ProductionReport, ApiError>({
    queryKey: qk.reports.one("production", rangeKey(user?.uid, range)),
    queryFn: () =>
      api.get<ProductionReport>("/v1/reports/production", { query: rangeQuery(range) }),
    enabled: !loading && !!user,
    staleTime: STALE_TIME,
  });
}

export function useInventoryReport(
  range?: ReportDateRange,
): UseQueryResult<InventoryReport, ApiError> {
  const api = useApi();
  const { user, loading } = useAuth();
  return useQuery<InventoryReport, ApiError>({
    queryKey: qk.reports.one("inventory", rangeKey(user?.uid, range)),
    queryFn: () =>
      api.get<InventoryReport>("/v1/reports/inventory", { query: rangeQuery(range) }),
    enabled: !loading && !!user,
    staleTime: STALE_TIME,
  });
}

export function useCostsReport(
  range?: ReportDateRange,
): UseQueryResult<CostsReport, ApiError> {
  const api = useApi();
  const { user, loading } = useAuth();
  return useQuery<CostsReport, ApiError>({
    queryKey: qk.reports.one("costs", rangeKey(user?.uid, range)),
    queryFn: () => api.get<CostsReport>("/v1/reports/costs", { query: rangeQuery(range) }),
    enabled: !loading && !!user,
    staleTime: STALE_TIME,
  });
}
