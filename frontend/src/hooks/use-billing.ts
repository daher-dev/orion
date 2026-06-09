"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { useApi } from "@/hooks/use-api";
import { qk } from "@/lib/query-keys";
import type { ApiError } from "@/lib/api-client";
import type { BillingSummary } from "@/lib/schemas/billing";

/** The signed-in tenant's plan, live usage vs. plan limits, and invoice stub. */
export function useBillingSummary(): UseQueryResult<BillingSummary, ApiError> {
  const api = useApi();
  return useQuery<BillingSummary, ApiError>({
    queryKey: qk.billing.summary(),
    queryFn: () => api.get<BillingSummary>("/v1/billing/summary"),
  });
}
