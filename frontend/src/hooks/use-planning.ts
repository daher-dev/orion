"use client";

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { qk } from "@/lib/query-keys";
import type { ApiError } from "@/lib/api-client";
import type {
  PlanningCutCreate,
  PlanningCutResult,
  PlanningPrintCreate,
  PlanningPrintResult,
  PlanningSuggestions,
} from "@/lib/schemas/planning";

const ROOT = "/v1/planning";

/**
 * The computed demand→production model: per-SKU demand breakdown + suggested
 * cortes (grouped by spec+color) + impressões (per design) + totals. Pure read,
 * recomputed live by the backend over open orders/order_items minus finished +
 * WIP + min-stock reorder. The page filters client-side (Tudo / Demanda /
 * Estoque baixo) like the prototype, so no filter is sent to the server.
 */
export function usePlanningSuggestions(): UseQueryResult<PlanningSuggestions, ApiError> {
  const api = useApi();
  return useQuery<PlanningSuggestions, ApiError>({
    queryKey: qk.planning.suggestions(),
    queryFn: () => api.get<PlanningSuggestions>(`${ROOT}/suggestions`),
  });
}

/**
 * Bulk-create PENDING cutting orders from selected corte suggestion keys. The
 * server recomputes suggestions inside the transaction (so a stale client
 * snapshot can't persist a wrong grade) and creates one roll-less order per key.
 * Invalidates the suggestions (the demand shrinks as WIP grows) + the Corte
 * board + blank-stock (in-production reflects the new open cutting).
 */
export function useCreateCuttingOrders() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<PlanningCutResult, ApiError, PlanningCutCreate>({
    mutationFn: (payload) => api.post<PlanningCutResult>(`${ROOT}/cutting-orders`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.planning.suggestions() });
      qc.invalidateQueries({ queryKey: qk.cutting.all() });
      qc.invalidateQueries({ queryKey: qk.blankStock.all() });
    },
  });
}

/**
 * Bulk-create PENDING print orders from selected impressão suggestion keys. The
 * server recomputes suggestions and resolves the FRONT variation per design,
 * creating one paper-less order each (silkscreen / no-variation / back-only /
 * stale designs are reported as skipped). Invalidates suggestions + the
 * Impressão board + printed-transfers (in-production reflects the new open print
 * orders).
 */
export function useCreatePrintOrders() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<PlanningPrintResult, ApiError, PlanningPrintCreate>({
    mutationFn: (payload) => api.post<PlanningPrintResult>(`${ROOT}/print-orders`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.planning.suggestions() });
      qc.invalidateQueries({ queryKey: qk.printOrders.all() });
      qc.invalidateQueries({ queryKey: qk.printedTransfers.all() });
    },
  });
}
