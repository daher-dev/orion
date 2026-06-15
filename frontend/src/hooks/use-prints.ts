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
  Print,
  PrintFilters,
  PrintPage,
  PrintFormPayload,
  PrintSide,
  PrintVariation,
  PrintVariationCreatePayload,
  PrintVariationUpdatePayload,
} from "@/lib/schemas/print";

const buildQuery = (filters: PrintFilters | undefined) => {
  if (!filters) return undefined;
  const query: Record<string, string> = {};
  if (filters.q) query.q = filters.q;
  if (filters.page) query.page = String(filters.page);
  if (filters.page_size) query.page_size = String(filters.page_size);
  return Object.keys(query).length > 0 ? query : undefined;
};

export function usePrints(filters?: PrintFilters): UseQueryResult<PrintPage, ApiError> {
  const api = useApi();
  return useQuery<PrintPage, ApiError>({
    queryKey: qk.prints.list(filters ?? {}),
    queryFn: () => api.get<PrintPage>("/v1/prints", { query: buildQuery(filters) }),
  });
}

export function usePrint(id: string | null): UseQueryResult<Print, ApiError> {
  const api = useApi();
  return useQuery<Print, ApiError>({
    queryKey: qk.prints.detail(id ?? ""),
    enabled: !!id,
    queryFn: () => api.get<Print>(`/v1/prints/${id}`),
  });
}

export function useCreatePrint() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<Print, ApiError, PrintFormPayload>({
    mutationFn: (payload) => api.post<Print>("/v1/prints", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.prints.lists() });
    },
  });
}

export function useUpdatePrint() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<Print, ApiError, { id: string; payload: Partial<PrintFormPayload> }>({
    mutationFn: ({ id, payload }) => api.patch<Print>(`/v1/prints/${id}`, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.prints.lists() });
      qc.invalidateQueries({ queryKey: qk.prints.detail(vars.id) });
    },
  });
}

export function useDeletePrint() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete<void>(`/v1/prints/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.prints.lists() });
    },
  });
}

// ----------------------------------------------------------------- variations

const invalidatePrint = (
  qc: ReturnType<typeof useQueryClient>,
  printId: string,
) => {
  qc.invalidateQueries({ queryKey: qk.prints.detail(printId) });
  qc.invalidateQueries({ queryKey: qk.prints.lists() });
};

/** POST /v1/prints/{printId}/variations */
export function useCreateVariation(printId: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<PrintVariation, ApiError, PrintVariationCreatePayload>({
    mutationFn: (payload) =>
      api.post<PrintVariation>(`/v1/prints/${printId}/variations`, payload),
    onSuccess: () => invalidatePrint(qc, printId),
  });
}

/** PATCH /v1/prints/{printId}/variations/{id} */
export function useUpdateVariation(printId: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<
    PrintVariation,
    ApiError,
    { id: string; payload: PrintVariationUpdatePayload }
  >({
    mutationFn: ({ id, payload }) =>
      api.patch<PrintVariation>(`/v1/prints/${printId}/variations/${id}`, payload),
    onSuccess: () => invalidatePrint(qc, printId),
  });
}

/** DELETE /v1/prints/{printId}/variations/{id} */
export function useDeleteVariation(printId: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) =>
      api.delete<void>(`/v1/prints/${printId}/variations/${id}`),
    onSuccess: () => invalidatePrint(qc, printId),
  });
}

/**
 * POST /v1/prints/{printId}/variations/{id}/artwork — multipart PNG upload.
 * Follows the `use-orders-import.ts` pattern: the api-client auto-detects
 * FormData and omits the Content-Type so the browser sets the boundary.
 */
export function useUploadArtwork(printId: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<
    PrintVariation,
    ApiError,
    { variationId: string; side: PrintSide; file: File }
  >({
    mutationFn: ({ variationId, side, file }) => {
      const fd = new FormData();
      fd.append("file", file, file.name);
      fd.append("side", side);
      return api.post<PrintVariation>(
        `/v1/prints/${printId}/variations/${variationId}/artwork`,
        fd,
      );
    },
    onSuccess: () => invalidatePrint(qc, printId),
  });
}
