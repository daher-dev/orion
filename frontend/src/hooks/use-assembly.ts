"use client";

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { qk } from "@/lib/query-keys";
import type { ApiError } from "@/lib/api-client";
import type {
  AssembleBody,
  AssemblyBuildablePage,
  AssemblyRun,
  BuildableFilters,
} from "@/lib/schemas/assembly";

const ROOT = "/v1/assembly";

function pruneUndefined<T extends Record<string, unknown>>(input: T): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = value as string | number | boolean;
  }
  return out;
}

/**
 * The on-hand discovery assist: every `(printed_transfer, candidate blank)`
 * pair with positive on-hand. Computed live by the backend — no writes.
 */
export function useBuildable(
  filters: BuildableFilters = {},
): UseQueryResult<AssemblyBuildablePage, ApiError> {
  const api = useApi();
  return useQuery<AssemblyBuildablePage, ApiError>({
    queryKey: qk.assembly.buildable(filters as Readonly<Record<string, unknown>>),
    queryFn: () =>
      api.get<AssemblyBuildablePage>(`${ROOT}/buildable`, {
        query: pruneUndefined({
          q: filters.q,
          print_design_id: filters.print_design_id,
          spec_id: filters.spec_id,
          page: filters.page,
          page_size: filters.page_size,
        }),
      }),
  });
}

/**
 * The T5 posting action. Assembling debits blank pieces + printed transfers and
 * credits finished stock for the resolved SKU — all three downstream views must
 * refresh, plus the buildable assist itself (its math reads live on-hand).
 */
export function useAssemble() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<AssemblyRun, ApiError, AssembleBody>({
    mutationFn: (payload) => api.post<AssemblyRun>(ROOT, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.assembly.buildable() });
      qc.invalidateQueries({ queryKey: qk.blankStock.all() });
      qc.invalidateQueries({ queryKey: qk.printedTransfers.all() });
      qc.invalidateQueries({ queryKey: qk.stock.all() });
    },
  });
}
