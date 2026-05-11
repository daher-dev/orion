"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { qk } from "@/lib/query-keys";
import type { ApiError } from "@/lib/api-client";
import type {
  CommitOrdersBody,
  CommitOrdersResponse,
  ParseResponse,
} from "@/lib/schemas/orders-import";

const PARSE_PATH = "/v1/orders/import/parse";
const COMMIT_PATH = "/v1/orders/import/commit";

/**
 * Upload a PDF or CSV to the backend parser and receive a list of
 * `ParsedOrderRow`s with their confidence scores. Mutation returns the
 * raw `ParseResponse` so the caller can also surface the optional
 * `notes` field (parser commentary).
 */
export function useParseOrders() {
  const api = useApi();
  return useMutation<ParseResponse, ApiError, File>({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file, file.name);
      // The endpoint also accepts an optional `format` override; we leave
      // it to the backend's `auto` sniffer in the UI flow.
      return api.post<ParseResponse>(PARSE_PATH, formData);
    },
  });
}

/**
 * Persist the reviewed rows. Returns `{ created, errors }` so the UI
 * can show partial failures inline without losing the user's edits.
 *
 * On any non-zero `created` count we invalidate the orders cache so the
 * /orders list reflects the new rows when the user navigates back.
 */
export function useCommitOrders() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<CommitOrdersResponse, ApiError, CommitOrdersBody>({
    mutationFn: (body: CommitOrdersBody) =>
      api.post<CommitOrdersResponse>(COMMIT_PATH, body),
    onSuccess: (result) => {
      if (result.created > 0) {
        void qc.invalidateQueries({ queryKey: qk.orders.all() });
        void qc.invalidateQueries({ queryKey: qk.clients.all() });
      }
    },
  });
}
