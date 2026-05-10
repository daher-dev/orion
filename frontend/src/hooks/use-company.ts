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
import type { CompanyRead, CompanyUpdate } from "@/lib/schemas/company";

/**
 * Hook into GET /v1/companies/me. Returns the company tied to the current
 * X-Orion-Company-Id header. Distinct from the CompanyProvider's `useCompany`
 * (which manages the active-tenant LocalStorage state).
 */
export function useMyCompany(): UseQueryResult<CompanyRead, ApiError> {
  const api = useApi();
  return useQuery<CompanyRead, ApiError>({
    queryKey: qk.settings.company(),
    queryFn: () => api.get<CompanyRead>("/v1/companies/me"),
  });
}

export function useUpdateCompany() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<CompanyRead, ApiError, CompanyUpdate>({
    mutationFn: (payload) => api.patch<CompanyRead>("/v1/companies/me", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.auth.me() });
      qc.invalidateQueries({ queryKey: qk.settings.company() });
    },
  });
}
