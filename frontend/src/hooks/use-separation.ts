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
  GenerateLabelsResponse,
  OrderItem,
  ScanCheckPayload,
  ScanCheckResponse,
} from "@/lib/schemas/separation";

const ROOT = "/v1/orders";

/** Per-piece separation items for one order. Fetched lazily (on expand). */
export function useOrderItems(
  orderId: string | null,
): UseQueryResult<OrderItem[], ApiError> {
  const api = useApi();
  return useQuery<OrderItem[], ApiError>({
    queryKey: qk.orders.items(orderId ?? ""),
    enabled: !!orderId,
    queryFn: () => api.get<OrderItem[]>(`${ROOT}/${orderId}/items`),
  });
}

/**
 * Generate/print an order's separation labels (pending → label_printed).
 * Lazily materializes one piece per unit of the order's quantity on first call;
 * idempotent on re-run. Returns the printable label payload.
 */
export function useGenerateLabels() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<GenerateLabelsResponse, ApiError, string>({
    mutationFn: (orderId) =>
      api.post<GenerateLabelsResponse>(`${ROOT}/${orderId}/labels`, {}),
    onSuccess: (_data, orderId) => {
      qc.invalidateQueries({ queryKey: qk.orders.items(orderId) });
      qc.invalidateQueries({ queryKey: qk.orders.all() });
    },
  });
}

/**
 * Scan-to-check a piece by its label's tracking code (label_printed → checked).
 * Tenant-scoped server-side; 404 unknown codes, 409 still-pending pieces.
 */
export function useScanCheck() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<ScanCheckResponse, ApiError, ScanCheckPayload>({
    mutationFn: (payload) =>
      api.post<ScanCheckResponse>(`${ROOT}/separation/scan`, payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.orders.items(data.order_id) });
      qc.invalidateQueries({ queryKey: qk.orders.all() });
    },
  });
}
