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
  Shipment,
  ShipmentCreatePayload,
  ShipmentFilters,
  ShipmentPage,
  ShipmentReceivePayload,
} from "@/lib/schemas/sewing";

const ROOT = "/v1/sewing";

const buildQuery = (filters: ShipmentFilters | undefined) => {
  if (!filters) return undefined;
  const query: Record<string, string> = {};
  if (filters.q) query.q = filters.q;
  if (filters.status) query.status = filters.status;
  if (filters.contractor_id) query.contractor_id = filters.contractor_id;
  if (filters.cutting_order_id) query.cutting_order_id = filters.cutting_order_id;
  if (filters.page) query.page = String(filters.page);
  if (filters.page_size) query.page_size = String(filters.page_size);
  return Object.keys(query).length > 0 ? query : undefined;
};

export function useShipments(
  filters?: ShipmentFilters,
): UseQueryResult<ShipmentPage, ApiError> {
  const api = useApi();
  return useQuery<ShipmentPage, ApiError>({
    queryKey: qk.sewing.list(filters ?? {}),
    queryFn: () => api.get<ShipmentPage>(ROOT, { query: buildQuery(filters) }),
  });
}

export function useShipment(id: string | null): UseQueryResult<Shipment, ApiError> {
  const api = useApi();
  return useQuery<Shipment, ApiError>({
    queryKey: qk.sewing.detail(id ?? ""),
    enabled: !!id,
    queryFn: () => api.get<Shipment>(`${ROOT}/${id}`),
  });
}

export function useCreateShipment() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<Shipment, ApiError, ShipmentCreatePayload>({
    mutationFn: (payload) => api.post<Shipment>(ROOT, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.sewing.all() }),
  });
}

export function useReceiveShipment() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<Shipment, ApiError, { id: string; payload: ShipmentReceivePayload }>({
    mutationFn: ({ id, payload }) => api.post<Shipment>(`${ROOT}/${id}/receive`, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.sewing.all() });
      qc.invalidateQueries({ queryKey: qk.sewing.detail(vars.id) });
    },
  });
}

export function useCancelShipment() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<Shipment, ApiError, string>({
    mutationFn: (id) => api.post<Shipment>(`${ROOT}/${id}/cancel`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: qk.sewing.all() });
      qc.invalidateQueries({ queryKey: qk.sewing.detail(id) });
    },
  });
}
