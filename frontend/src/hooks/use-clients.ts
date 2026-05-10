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
  ClientCreate,
  ClientFilters,
  ClientPage,
  ClientRead,
  ClientUpdate,
} from "@/lib/schemas/client";

const buildQuery = (filters: ClientFilters | undefined) => {
  if (!filters) return undefined;
  const query: Record<string, string> = {};
  if (filters.q) query.q = filters.q;
  if (filters.page) query.page = String(filters.page);
  if (filters.pageSize) query.page_size = String(filters.pageSize);
  return Object.keys(query).length > 0 ? query : undefined;
};

export function useClients(
  filters?: ClientFilters,
): UseQueryResult<ClientPage, ApiError> {
  const api = useApi();
  return useQuery<ClientPage, ApiError>({
    queryKey: qk.clients.list(filters ?? {}),
    queryFn: () => api.get<ClientPage>("/v1/clients", { query: buildQuery(filters) }),
  });
}

export function useClient(id: string | null): UseQueryResult<ClientRead, ApiError> {
  const api = useApi();
  return useQuery<ClientRead, ApiError>({
    queryKey: qk.clients.detail(id ?? ""),
    enabled: !!id,
    queryFn: () => api.get<ClientRead>(`/v1/clients/${id}`),
  });
}

export function useCreateClient() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<ClientRead, ApiError, ClientCreate>({
    mutationFn: (payload) => api.post<ClientRead>("/v1/clients", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.clients.lists() });
    },
  });
}

export function useUpdateClient() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<ClientRead, ApiError, { id: string; payload: ClientUpdate }>({
    mutationFn: ({ id, payload }) => api.patch<ClientRead>(`/v1/clients/${id}`, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.clients.lists() });
      qc.invalidateQueries({ queryKey: qk.clients.detail(vars.id) });
    },
  });
}

export function useDeleteClient() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete<void>(`/v1/clients/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.clients.lists() });
    },
  });
}
